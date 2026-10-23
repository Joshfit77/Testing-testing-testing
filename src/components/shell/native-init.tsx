"use client";
import { useEffect } from "react";
import { initNativeShell } from "@/lib/native";
import { installSleepAlarmActions, syncSleepAlarmFromAccount } from "@/lib/native-alarm";
import { getSleepAlarmConfigAction } from "@/server/actions/sleep";

export function NativeInit() {
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    void initNativeShell().then((c) => cleanups.push(c));
    void installSleepAlarmActions().then((c) => cleanups.push(c));
    void syncSleepAlarmFromAccount(getSleepAlarmConfigAction);
    return () => cleanups.forEach((c) => c());
  }, []);
  return null;
}
