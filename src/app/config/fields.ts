import type { Parameters } from "../../simulation";

export const fields: {
  key: keyof Parameters;
  title: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}[] = [
  {
    key: "threshold",
    title: "低流量阈值",
    unit: "l/min",
    min: 0,
    max: 32767,
    step: 1,
  },
  {
    key: "delay",
    title: "自动控制延迟",
    unit: "min",
    min: 0,
    max: 65535,
    step: 1,
  },
  {
    key: "normal",
    title: "正常工作压力",
    unit: "bar",
    min: 2.5,
    max: 10,
    step: 0.1,
  },
  {
    key: "standby",
    title: "待机压力",
    unit: "bar",
    min: 2.5,
    max: 10,
    step: 0.1,
  },
  {
    key: "userPressure",
    title: "手动设定压力",
    unit: "bar",
    min: 2.5,
    max: 10,
    step: 0.1,
  },
  {
    key: "price",
    title: "压缩空气单价",
    unit: "¥/m³",
    min: 0,
    max: 100,
    step: 0.01,
  },
  {
    key: "leakLimit",
    title: "压降提示阈值",
    unit: "bar/s",
    min: 0.01,
    max: 10,
    step: 0.01,
  },
];
