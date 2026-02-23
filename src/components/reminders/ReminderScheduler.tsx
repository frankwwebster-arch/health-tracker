"use client";

import { useEffect, useRef } from "react";
import { getDayData, getSettings, getLastNotified, setLastNotified } from "@/db";
import { getDateKey } from "@/types";
import type { DayData, Settings } from "@/types";
import { useReminders } from "./ReminderContext";
import type { ReminderType } from "./ReminderContext";

const QUIET_START = 20 * 60; // 20:00 in minutes
const QUIET_END = 7 * 60; // 07:00
const COOLDOWN_MS = 45 * 60 * 1000;

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function isWeekday(): boolean {
  const day = new Date().getDay();
  return day >= 1 && day <= 5;
}

function isWithinQuietHours(): boolean {
  const n = nowMinutes();
  if (QUIET_END < QUIET_START) return n >= QUIET_START || n < QUIET_END;
  return n >= QUIET_START && n < QUIET_END;
}

function shouldFireReminder(
  settings: Settings,
  lastNotified: Record<string, number>,
  reminderId: string
): boolean {
  if (!settings.remindersEnabled) return false;
  if (settings.weekdayOnly && !isWeekday()) return false;
  if (isWithinQuietHours()) return false;
  const last = lastNotified[reminderId] ?? 0;
  return Date.now() - last >= COOLDOWN_MS;
}

function getReminderId(type: ReminderType, suffix?: string): string {
  return suffix ? `${type}-${suffix}` : type;
}

export function ReminderScheduler() {
  const { addReminder } = useReminders();
  const notifiedThisRun = useRef<Set<string>>(new Set());

  useEffect(() => {
    async function check() {
      const dateKey = getDateKey();
      const [dayData, settings, lastNotified] = await Promise.all([
        getDayData(dateKey),
        getSettings(),
        getLastNotified(dateKey),
      ]);

      const now = nowMinutes();
      const nowMs = Date.now();

      const maybeNotify = async (
        id: string,
        title: string,
        type: ReminderType,
        condition: boolean
      ) => {
        if (!condition || !shouldFireReminder(settings, lastNotified, id))
          return;
        if (notifiedThisRun.current.has(id)) return;
        notifiedThisRun.current.add(id);
        await setLastNotified(dateKey, id, nowMs);
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const n = new Notification("Health Tracker", { body: title });
          n.onclick = () => window.focus();
        }
        addReminder({ id, type, title });
      };

      // Medication
      if (settings.medicationRemindersEnabled) {
        const dexTimes = Array.isArray(settings.medicationTimes.dex)
          ? settings.medicationTimes.dex
          : ["07:00", "12:30", "15:30"];
        for (let i = 0; i < dexTimes.length; i++) {
          const key = `dex-${i}` as ReminderType;
          const taken = dayData.medication.dex?.doses?.[i]?.taken ?? false;
          const scheduled = parseTime(dexTimes[i]);
          const atTime = now >= scheduled && now < scheduled + 60;
          await maybeNotify(
            getReminderId(key),
            `Dex dose ${i + 1} – time to take`,
            key,
            !taken && atTime
          );
        }
        const bupropionTaken = dayData.medication.bupropion.taken;
        const bupropionScheduled = parseTime(settings.medicationTimes.bupropion);
        const bupropionAtTime = now >= bupropionScheduled && now < bupropionScheduled + 60;
        await maybeNotify(
          getReminderId("bupropion"),
          "Bupropion – time to take",
          "bupropion",
          !bupropionTaken && bupropionAtTime
        );
      }

      // Custom medications
      if (settings.medicationRemindersEnabled && settings.customMeds?.length) {
        for (const med of settings.customMeds) {
          const taken = dayData.customMedsTaken?.[med.id]?.taken ?? false;
          const scheduled = parseTime(med.time);
          const atTime = now >= scheduled && now < scheduled + 60;
          await maybeNotify(
            `custom-${med.id}`,
            `${med.name} – time to take`,
            "custom" as ReminderType,
            !taken && atTime
          );
        }
      }

      // Lunch
      const lunchTime = parseTime(settings.lunchReminderTime);
      const lunchWindow = now >= lunchTime && now < lunchTime + 60;
      await maybeNotify(
        "lunch",
        "Remember lunch?",
        "lunch",
        !dayData.lunchEaten && lunchWindow
      );

      // Water: every N minutes within window (one reminder per interval)
      const waterStart = parseTime(settings.waterStartTime);
      const waterEnd = parseTime(settings.waterEndTime);
      const inWaterWindow =
        waterEnd > waterStart
          ? now >= waterStart && now <= waterEnd
          : now >= waterStart || now <= waterEnd;
      const waterGoalReached = dayData.waterMl >= settings.waterGoalMl;
      const intervalMin = settings.waterIntervalMinutes;
      const slot = Math.floor(now / intervalMin);
      const waterId = `water-${slot}`;
      const waterCooldown = intervalMin * 60 * 1000;
      const lastWater = lastNotified[waterId] ?? 0;
      const waterOk =
        settings.remindersEnabled &&
        (!settings.weekdayOnly || isWeekday()) &&
        !isWithinQuietHours() &&
        !waterGoalReached &&
        inWaterWindow &&
        Date.now() - lastWater >= waterCooldown &&
        !notifiedThisRun.current.has(waterId);
      if (waterOk) {
        notifiedThisRun.current.add(waterId);
        setLastNotified(dateKey, waterId, nowMs).then(() => {});
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const n = new Notification("Health Tracker", { body: "Time for water? +250ml" });
          n.onclick = () => window.focus();
        }
        addReminder({ id: waterId, type: "water", title: "Time for water? +250ml" });
      }

      // Supply: once per day when any medication has 7 days or less
      const supplyId = "supply";
      const supplyCooldown = 24 * 60 * 60 * 1000;
      const lastSupply = lastNotified[supplyId] ?? 0;
      const pillsPerDay = settings.medicationPillsPerDay ?? { dex: 3, bupropion: 1 };
      const builtInLow = settings.medicationSupply &&
        Object.entries(settings.medicationSupply).some(([key, held]) => {
          const perDay = pillsPerDay[key as keyof typeof pillsPerDay] || 1;
          const daysLeft = perDay > 0 ? Math.floor(held / perDay) : 0;
          return held > 0 && daysLeft <= 7;
        });
      const customLow = settings.customMeds?.some((med) => {
        const daysLeft = med.pillsPerDay > 0 ? Math.floor(med.supply / med.pillsPerDay) : 0;
        return med.supply > 0 && daysLeft <= 7;
      });
      const supplyLow = builtInLow || customLow;
      const supplyOk =
        settings.remindersEnabled &&
        supplyLow &&
        Date.now() - lastSupply >= supplyCooldown &&
        !notifiedThisRun.current.has(supplyId) &&
        !isWithinQuietHours();
      if (supplyOk) {
        const builtInLabels: Record<string, string> = { dex: "Dex", bupropion: "Bupropion" };
        const builtInNames = (settings.medicationSupply
          ? Object.entries(settings.medicationSupply)
              .filter(([key, held]) => {
                const perDay = pillsPerDay[key as keyof typeof pillsPerDay] || 1;
                const daysLeft = perDay > 0 ? Math.floor(held / perDay) : 0;
                return held > 0 && daysLeft <= 7;
              })
              .map(([k]) => builtInLabels[k] ?? k)
          : []) as string[];
        const customNames = (settings.customMeds ?? [])
          .filter((med) => {
            const daysLeft = med.pillsPerDay > 0 ? Math.floor(med.supply / med.pillsPerDay) : 0;
            return med.supply > 0 && daysLeft <= 7;
          })
          .map((m) => m.name);
        const lowNames = [...builtInNames, ...customNames].join(", ");
        const title = `Low supply: ${lowNames}. Refill soon.`;
        notifiedThisRun.current.add(supplyId);
        setLastNotified(dateKey, supplyId, nowMs).then(() => {});
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const n = new Notification("Health Tracker", { body: title });
          n.onclick = () => window.focus();
        }
        addReminder({ id: supplyId, type: "supply", title });
      }
    }

    const interval = setInterval(() => {
      notifiedThisRun.current.clear();
      check();
    }, 60 * 1000);
    notifiedThisRun.current.clear();
    check();
    return () => clearInterval(interval);
  }, [addReminder]);

  return null;
}
