import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defaults } from '../types';
import type { Mode, Parameters, Snapshot } from '../types';
import type { Language } from '../../translate';
import { api } from '../api';
import type { Connection, DeviceStatus } from '../api';
import { isConnection, isParameters, parameterScope, parameterStorageKey, readStored, storageKeys, writeStored } from '../persistence';

export function useDevice(notify:(message:string)=>void, language:Language) {
  const [savedConnection,setSavedConnection] = useState(()=>readStored(storageKeys.connection,isConnection));
  const [backend,setBackend] = useState<DeviceStatus|null>(null);
  const [apiError,setApiError] = useState('');
  const [busy,setBusy] = useState(false);
  const busyRef = useRef(false);
  const requestGeneration = useRef(0);
  const [liveSamples,setLiveSamples] = useState<Snapshot[]>([]);
  const lastTimestamp = useRef(0);
  const languageRef = useRef(language);
  const settingsScope = parameterScope(backend?.connection??savedConnection);
  const params = useMemo(()=>backend?.parameters??readStored(parameterStorageKey(settingsScope),isParameters)??defaults,[settingsScope,backend?.parameters]);
  const rememberStatus = useCallback((data:DeviceStatus)=>{
    if (data.connection) {
      writeStored(storageKeys.connection,data.connection);
      setSavedConnection(data.connection);
      if (data.parameters) writeStored(parameterStorageKey(parameterScope(data.connection)),data.parameters);
    }
    setBackend(data);
  },[]);
  useEffect(()=>{ languageRef.current = language; },[language]);
  const zh = language === 'zh';
  useEffect(()=>{
    let stopped = false;
    let timer:ReturnType<typeof setTimeout>;
    const refresh = async () => {
      const generation = requestGeneration.current;
      try {
        if (busyRef.current) return;
        const data = await api<DeviceStatus>('/status');
        if (stopped || generation !== requestGeneration.current) return;
        rememberStatus(data); setApiError('');
        const t = data.telemetry;
        if (data.fresh && t && t.timestamp !== lastTimestamp.current) {
          lastTimestamp.current = t.timestamp;
          setLiveSamples(s=>[...s.slice(-59),{...t,delta:t.delta??0}]);
        }
      } catch {
        if (!stopped && generation === requestGeneration.current) { setApiError(languageRef.current === 'zh'?'后端服务不可用':'Backend unavailable'); setBackend(null); }
      } finally { if (!stopped) timer=setTimeout(refresh,1000); }
    };
    void refresh();
    return ()=>{ stopped=true; clearTimeout(timer); };
  },[rememberStatus]);
  async function perform(path:string,body:unknown, message?:string) {
    if (busyRef.current) throw new Error(zh?'操作进行中':'Operation in progress');
    busyRef.current=true;requestGeneration.current++;setBusy(true);
    try {
      const data=await api<DeviceStatus>(path,body);
      rememberStatus(data);setApiError('');
      const t = data.telemetry;
      if (data.fresh && t && t.timestamp !== lastTimestamp.current) {
        lastTimestamp.current = t.timestamp;
        setLiveSamples(s=>[...s.slice(-59),{...t,delta:t.delta??0}]);
      }
      if (message) notify(message);
      return data;
    } catch(error) {
      const message=error instanceof Error?error.message:String(error);
      setApiError(message);throw error;
    } finally { requestGeneration.current++;busyRef.current=false;setBusy(false); }
  }
  function command(action:string,value?:unknown) {
    return perform('/control',{action,value},zh?'设备已确认指令':'Device acknowledged command');
  }
  function handle(promise:Promise<unknown>) { void promise.catch(error=>notify(error.message)); }
  function changeMode(mode:Mode) { handle(command('mode',mode)); }
  function resetTimer() { handle(command('reset-timer')); }
  async function resetConsumption() { await command('reset-consumption'); }
  async function connect(connection:Connection) {
    writeStored(storageKeys.connection,connection);setSavedConnection(connection);
    setBackend(null);setLiveSamples([]);lastTimestamp.current=0;
    await perform('/connect',connection,zh?'连接已建立':'Connection established');
  }
  async function disconnect() { await perform('/disconnect',{}); }
  async function applyParameters(next:Parameters) {
    await perform('/parameters',next);
  }
  return {
    backend,busy,apiError,connect,disconnect,applyParameters,
    params,settingsScope,savedConnection,settingsReady:backend!==null||apiError!=='',
    refreshParameters:()=>perform('/parameters/read',{}),
    releaseReset:()=>command('release-reset'),
    startConsumption:()=>command('consumption-run',true),
    select32Bit:()=>command('consumption-32'),
    mode:backend?.controls?.mode??((backend?.telemetry?.stateCode??0)>=8?'auto':'user'),
    enabled:backend?.controls?.enabled??false,
    manualOpen:backend?.controls?.manualOpen??false,
    valveOpen:backend?.telemetry?.valveOpen??false,
    setEnabled:(value:boolean)=>handle(command('enabled',value)),
    setManualOpen:(value:boolean)=>handle(command('valve',value)),
    samples:liveSamples,
    dataReady:(!!backend?.fresh&&liveSamples.length>0),
    deltaReady:backend?.telemetry?.delta!=null,
    canControl:!busy&&!!backend?.canWrite,
    changeMode,resetTimer,resetConsumption,
  };
}
export type DeviceController = ReturnType<typeof useDevice>;
