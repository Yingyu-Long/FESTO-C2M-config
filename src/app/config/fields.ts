import type { Parameters } from "../types";

export const fields: {
  key: keyof Parameters;
  title: string;
  titleEn: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}[] = [
  {
    key: "threshold",
    title: "低流量阈值",
    titleEn: "Low-flow threshold",
    unit: "l/min",
    min: 0,
    max: 32767,
    step: 1,
  },
  {
    key: "delay",
    title: "自动控制延迟",
    titleEn: "Automatic control delay",
    unit: "min",
    min: 0,
    max: 65535,
    step: 1,
  },
  {
    key: "normal",
    title: "正常工作压力",
    titleEn: "Normal operating pressure",
    unit: "bar",
    min: 2.5,
    max: 10,
    step: 0.1,
  },
  {
    key: "standby",
    title: "待机压力",
    titleEn: "Standby pressure",
    unit: "bar",
    min: 2.5,
    max: 10,
    step: 0.1,
  },
  {
    key: "userPressure",
    title: "手动设定压力",
    titleEn: "Manual set pressure",
    unit: "bar",
    min: 2.5,
    max: 10,
    step: 0.1,
  },
  {
    key: "price",
    title: "压缩空气单价",
    titleEn: "Compressed air price",
    unit: "¥/m³",
    min: 0,
    max: 100,
    step: 0.01,
  },
  {
    key: "leakLimit",
    title: "压降提示阈值",
    titleEn: "Pressure-drop alert threshold",
    unit: "bar/s",
    min: 0.01,
    max: 10,
    step: 0.01,
  },
];
