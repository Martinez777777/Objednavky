import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as ftp from 'basic-ftp';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';

const FIREBASE_PROJECT_ID = 'dochadzka-web';
const FIREBASE_API_KEY = 'AIzaSyDy_MzgOTL67A6P08UtptHVpcdpYik6Fgc';

async function firestoreGet(collectionId: string, documentId: string): Promise<any> {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionId}/${documentId}?key=${FIREBASE_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Firestore GET failed: ${response.status}`);
  }
  const data = await response.json();
  return parseFirestoreDocument(data);
}

async function firestoreSet(collectionId: string, documentId: string, data: any): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionId}/${documentId}?key=${FIREBASE_API_KEY}`;
  const firestoreData = toFirestoreDocument(data);
  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreData })
  });
}

function parseFirestoreDocument(doc: any): any {
  if (!doc || !doc.fields) return {};
  const result: any = {};
  for (const [key, value] of Object.entries(doc.fields as Record<string, any>)) {
    result[key] = parseFirestoreValue(value);
  }
  return result;
}

function parseFirestoreValue(value: any): any {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return parseInt(value.integerValue, 10);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  if (value.arrayValue !== undefined) {
    return (value.arrayValue.values || []).map(parseFirestoreValue);
  }
  if (value.mapValue !== undefined) {
    return parseFirestoreDocument(value.mapValue);
  }
  return null;
}

function toFirestoreDocument(data: any): any {
  const fields: any = {};
  for (const [key, value] of Object.entries(data)) {
    fields[key] = toFirestoreValue(value);
  }
  return fields;
}

function toFirestoreValue(value: any): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: toFirestoreDocument(value) } };
  }
  return { stringValue: String(value) };
}

async function getBratislavaTime(): Promise<Date> {
  // Use a reliable method to get Central European Time (CET/CEST)
  // Intl.DateTimeFormat with timeZone is correct, but creating a Date from the string can be tricky
  // due to local server time interference.
  const now = new Date();
  const bratislavaString = now.toLocaleString("en-US", { 
    timeZone: "Europe/Bratislava",
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Parse: "MM/DD/YYYY, HH:mm:ss"
  const [datePart, timePart] = bratislavaString.split(', ');
  const [month, day, year] = datePart.split('/').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);
  
  return new Date(year, month - 1, day, hour, minute, second);
}

async function uploadPhotoFTP(name: string, base64Data: string, logId?: string): Promise<{ success: boolean; objectPath: string }> {
  const buffer = Buffer.from(base64Data, 'base64');
  const client = new ftp.Client();
  
  await client.access({
    host: "37.9.175.156",
    user: "aplikacia.tofako.sk",
    password: "Aplikacia1",
    secure: false,
    port: 21
  });

  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  await client.uploadFrom(stream, `Fotky/${name}`);
  client.close();

  const objectPath = `https://aplikacia.tofako.sk/Fotky/${name}`;

  if (logId) {
    const databazaData = await firestoreGet("Global", "Databaza") || {};
    if (databazaData[logId]) {
      databazaData[logId]["Foto"] = objectPath;
      await firestoreSet("Global", "Databaza", databazaData);
    }
  }

  return { success: true, objectPath };
}

async function uploadExportFTP(name: string, buffer: Buffer): Promise<{ success: boolean; objectPath: string }> {
  const client = new ftp.Client();
  await client.access({
    host: "37.9.175.156",
    user: "aplikacia.tofako.sk",
    password: "Aplikacia1",
    secure: false,
    port: 21
  });

  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  await client.uploadFrom(stream, `Exporty/${name}`);
  client.close();
  return { success: true, objectPath: `https://aplikacia.tofako.sk/Exporty/${name}` };
}

async function verifyEmployee(code: string): Promise<string | null> {
  const employeesData = await firestoreGet("Global", "Zamestnanci");
  if (!employeesData || typeof employeesData !== 'object') {
    return null;
  }

  const searchCode = String(code).trim();
  
  for (const [key, value] of Object.entries(employeesData)) {
    const trimmedKey = String(key).trim();
    if (trimmedKey === searchCode || Number(trimmedKey) === Number(searchCode)) {
      return String(value);
    }
  }

  return null;
}

async function getAdminCode(): Promise<string> {
  const data = await firestoreGet("Global", "adminCode");
  if (!data) return "12345";
  return String(data.adminCode || "");
}

async function getStores(): Promise<string[]> {
  const data = await firestoreGet("Global", "Prevadzky");
  if (!data) return [];
  return Object.keys(data)
    .sort((a, b) => Number(a) - Number(b))
    .map(key => data[key]);
}

interface CreateAttendanceInput {
  code: string;
  type: string;
  selectedStore?: string;
  photoPath?: string;
  clientTimestamp?: string;
  isManual?: boolean;
}

interface AttendanceResult {
  id: string;
  code: string;
  type: string;
  meno: string;
  createdAt: Date;
}

async function createAttendanceLog(input: CreateAttendanceInput): Promise<AttendanceResult> {
  const { code, type, selectedStore, photoPath, clientTimestamp, isManual } = input;

  const employeeName = await verifyEmployee(code);
  if (!employeeName) {
    throw new Error("Neplatný kód zamestnanca");
  }

  const dbData = await firestoreGet("Global", "Databaza") || {};
  const logs = Object.values(dbData) as any[];

  if (type === "arrival" && !isManual) {
    const currentStore = selectedStore || "Neznáma prevádzka";
    const limitData = await firestoreGet(currentStore, "Pocet");
    const limit = parseInt(limitData?.Pocet || "0", 10);

    if (limit > 0) {
      const dbDataActive = await firestoreGet("Global", "Databaza") || {};
      const allLogs = Object.values(dbDataActive) as any[];
      
      const employeeLogsMap: Record<string, any[]> = {};
      const parseTime = (dateStr: string, timeStr: string) => {
        if (!dateStr || !timeStr) return 0;
        const [d, m, y] = dateStr.split('.').map(Number);
        const [hh, mm, ss] = timeStr.split(':').map(Number);
        return new Date(y, m - 1, d, hh, mm, ss || 0).getTime();
      };

      allLogs.forEach(log => {
        const logCode = String(log["Kód"]);
        if (!logCode || logCode === "undefined" || logCode === "null") return;
        if (!employeeLogsMap[logCode]) employeeLogsMap[logCode] = [];
        employeeLogsMap[logCode].push(log);
      });

      let activeCount = 0;
      const activeDetails: any[] = [];

      Object.keys(employeeLogsMap).forEach(logCode => {
        const empLogs = employeeLogsMap[logCode].sort((a, b) => {
          return parseTime(b["dátum"], b["Original čas príchodu"]) - parseTime(a["dátum"], a["Original čas príchodu"]);
        });
        
        const lastAtt = empLogs.find(l => ["Príchod", "arrival", "Odchod", "departure"].includes(l["Akcia"]));
        if (lastAtt && (lastAtt["Akcia"] === "Príchod" || lastAtt["Akcia"] === "arrival") && lastAtt["Prevádzka"] === currentStore) {
          activeCount++;
          activeDetails.push({
            meno: lastAtt["Meno"],
            datum: lastAtt["dátum"],
            cas: lastAtt["Original čas príchodu"]
          });
        }
      });

      if (activeCount >= limit) {
        const detailsStr = activeDetails.map(d => `${d.meno} ${d.datum} ${d.cas}`).join("\n");
        throw new Error(`ERR_LIMIT_EXCEEDED|${detailsStr}`);
      }
    }

    const employeeLogs = logs
      .filter(l => String(l["Kód"]) === String(code))
      .sort((a, b) => {
        try {
          const [d, m, y] = a["dátum"].split('.').map(Number);
          const [hh, mm, ss] = a["Original čas príchodu"].split(':').map(Number);
          const timeA = new Date(y, m - 1, d, hh, mm, ss).getTime();

          const [d2, m2, y2] = b["dátum"].split('.').map(Number);
          const [hh2, mm2, ss2] = b["Original čas príchodu"].split(':').map(Number);
          const timeB = new Date(y2, m2 - 1, d2, hh2, mm2, ss2).getTime();
          
          return timeB - timeA;
        } catch(e) { return 0; }
      });

    if (employeeLogs.length > 0) {
      const lastLog = employeeLogs[0];
      const lastAction = lastLog["Akcia"];
      if (lastAction === "Príchod" || lastAction === "arrival") {
        throw new Error(`Zabudol si sa odhlásiť. Napíš manažérovi, ináč sa ti nezaráta zmena. Si prihlásený od ${lastLog["dátum"]} ${lastLog["Original čas príchodu"]} na prevádzke ${lastLog["Prevádzka"] || "neznámej"}`);
      }
    }
  }

  if (type === "departure" && !isManual) {
    const employeeLogs = logs
      .filter(l => String(l["Kód"]) === String(code))
      .sort((a, b) => {
        try {
          const [d, m, y] = a["dátum"].split('.').map(Number);
          const [hh, mm, ss] = a["Original čas príchodu"].split(':').map(Number);
          const timeA = new Date(y, m - 1, d, hh, mm, ss).getTime();

          const [d2, m2, y2] = b["dátum"].split('.').map(Number);
          const [hh2, mm2, ss2] = b["Original čas príchodu"].split(':').map(Number);
          const timeB = new Date(y2, m2 - 1, d2, hh2, mm2, ss2).getTime();
          
          return timeB - timeA;
        } catch(e) { return 0; }
      });

    const lastLog = employeeLogs.length > 0 ? employeeLogs.find(l => ["Príchod", "arrival", "Odchod", "departure"].includes(l["Akcia"])) : null;
    const lastAction = lastLog ? lastLog["Akcia"] : null;
    const lastStore = lastLog ? lastLog["Prevádzka"] : null;
    const currentStore = selectedStore || "Neznáma prevádzka";
    
    if (!lastLog || (lastAction !== "Príchod" && lastAction !== "arrival")) {
      throw new Error("ERR_NO_ARRIVAL");
    }

    if (lastAction === "Odchod" || lastAction === "departure") {
      throw new Error("Zabudol si sa prihlásiť. Napíš manažérovi ináč sa ti nezapíše zmena.");
    }

    if (lastStore && lastStore !== currentStore) {
      throw new Error(`ERR_WRONG_STORE:${lastStore}`);
    }

    const lastArrivalDate = lastLog["dátum"];
    const now = clientTimestamp ? new Date(clientTimestamp) : await getBratislavaTime();
    
    // Použitie času zo synchronizácie, ak je k dispozícii
    const formattedNowDate = new Intl.DateTimeFormat('sk-SK', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);

    if (lastArrivalDate !== formattedNowDate) {
      throw new Error("ERR_NEW_DAY");
    }
  }

  const now = clientTimestamp ? new Date(clientTimestamp) : await getBratislavaTime();
  
  const dateOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };

  const formattedDate = new Intl.DateTimeFormat('sk-SK', dateOptions).format(now);
  const formattedTime = new Intl.DateTimeFormat('sk-SK', timeOptions).format(now);

  const daysSk: Record<string, string> = {
    "Monday": "Pondelok", "Tuesday": "Utorok", "Wednesday": "Streda", "Thursday": "Štvrtok",
    "Friday": "Piatok", "Saturday": "Sobota", "Sunday": "Nedeľa"
  };
  const dayNameEn = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now);
  const dayNameSk = daysSk[dayNameEn];
  const prevadzka = selectedStore || "Neznáma prevádzka";

  let timestamp = now;
  let formattedRoundedTime = "";

  if ((type === "arrival" || type === "departure") && !isManual) {
    const hoursData = await firestoreGet(prevadzka, "Otvaracie_hodiny");
    const todayHours = hoursData?.[dayNameSk];

    if (todayHours && todayHours !== "Zatvorené") {
      const [openStr, closeStr] = todayHours.split('-').map((s: string) => s.trim());
      const [openH, openM] = openStr.split(':').map(Number);
      const [closeH, closeM] = closeStr.split(':').map(Number);

      const openingTime = new Date(now);
      openingTime.setHours(openH, openM, 0, 0);
      const closingTime = new Date(now);
      closingTime.setHours(closeH, closeM, 0, 0);

      if (type === "arrival") {
        if (now < openingTime) {
          timestamp = openingTime;

          const fixHoursData = await firestoreGet(prevadzka, "Fix_Otvaracie");
          if (fixHoursData?.Status === "1") {
            const fixTimeStr = fixHoursData?.[dayNameSk];
            if (fixTimeStr && fixTimeStr.includes(":")) {
              const parts = fixTimeStr.split(":");
              const hh = parts[0].padStart(2, "0");
              const mm = parts[1].padStart(2, "0");
              formattedRoundedTime = `${hh}:${mm}:00`;
            } else {
              formattedRoundedTime = new Intl.DateTimeFormat('sk-SK', timeOptions).format(timestamp);
            }
          } else {
            formattedRoundedTime = new Intl.DateTimeFormat('sk-SK', timeOptions).format(timestamp);
          }
        } else if (now > closingTime) {
          throw new Error("ERR_STORE_CLOSED|Je zatvorené nemôžeš sa prihlásiť!");
        } else {
          const ms = 1000 * 60 * 30;
          const roundedTime = Math.round(now.getTime() / ms) * ms;
          timestamp = new Date(roundedTime);
          formattedRoundedTime = new Intl.DateTimeFormat('sk-SK', timeOptions).format(timestamp);
        }
      } else if (type === "departure") {
        if (now < openingTime) {
          throw new Error("ERR_STORE_CLOSED_DEPARTURE|Je zatvorené! Nemôžeš sa odhlásiť.");
        } else if (now > closingTime) {
          timestamp = closingTime;

          const fixClosingData = await firestoreGet(prevadzka, "Fix_Zatvaracie");
          if (fixClosingData?.Status === "1") {
            const fixTimeStr = fixClosingData?.[dayNameSk];
            if (fixTimeStr && fixTimeStr.includes(":")) {
              const parts = fixTimeStr.split(":");
              const hh = parts[0].padStart(2, "0");
              const mm = parts[1].padStart(2, "0");
              formattedRoundedTime = `${hh}:${mm}:00`;
            } else {
              formattedRoundedTime = new Intl.DateTimeFormat('sk-SK', timeOptions).format(timestamp);
            }
          } else {
            formattedRoundedTime = new Intl.DateTimeFormat('sk-SK', timeOptions).format(timestamp);
          }
        } else {
          const ms = 1000 * 60 * 30;
          const roundedTime = Math.round(now.getTime() / ms) * ms;
          timestamp = new Date(roundedTime);
          formattedRoundedTime = new Intl.DateTimeFormat('sk-SK', timeOptions).format(timestamp);
        }
      }
    } else if (todayHours === "Zatvorené") {
      const actionText = type === "arrival" ? "prihlásiť" : "odhlásiť";
      throw new Error(`ERR_STORE_CLOSED_DAY|Je zatvorené. Nemôžeš sa ${actionText}!`);
    } else {
      const ms = 1000 * 60 * 30;
      const roundedTime = Math.round(now.getTime() / ms) * ms;
      timestamp = new Date(roundedTime);
      formattedRoundedTime = new Intl.DateTimeFormat('sk-SK', timeOptions).format(timestamp);
    }
  } else if ((type === "arrival" || type === "departure") && isManual) {
    const ms = 1000 * 60 * 30;
    const roundedTime = Math.round(now.getTime() / ms) * ms;
    timestamp = new Date(roundedTime);
    formattedRoundedTime = new Intl.DateTimeFormat('sk-SK', timeOptions).format(timestamp);
  }

  const logId = `log_${new Date().getTime()}`;
  
  const currentDbData = await firestoreGet("Global", "Databaza") || {};
  currentDbData[logId] = {
    "Kód": code,
    "Meno": employeeName,
    "dátum": formattedDate,
    "Original čas príchodu": formattedTime,
    "Zaokruhlený čas príchodu": formattedRoundedTime,
    "Akcia": type === "arrival" ? "Príchod" : type === "departure" ? "Odchod" : type === "lunch" ? "Obed" : "Dovolenka",
    "Prevádzka": prevadzka,
    "Foto": photoPath || ""
  };
  
  await firestoreSet("Global", "Databaza", currentDbData);

  return {
    id: logId,
    code,
    type,
    meno: employeeName,
    createdAt: now
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let url = req.url || '';
  if (!url.startsWith('/api')) {
    url = '/api' + (url.startsWith('/') ? url : '/' + url);
  }
  url = url.split('?')[0];
  const method = req.method || 'GET';

  try {
    // POST /api/export/individual
    if (url.includes('/api/export/individual') && method === 'POST') {
      const { startDate, endDate, store } = req.body;
      const dbData = await firestoreGet("Global", "Databaza") || {};
      let logs = Object.values(dbData) as any[];

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        logs = logs.filter(log => {
          const logDateParts = log["dátum"].split('.');
          if (logDateParts.length !== 3) return false;
          const logDate = new Date(Number(logDateParts[2]), Number(logDateParts[1]) - 1, Number(logDateParts[0]));
          
          // Filter by date
          const inDateRange = logDate >= start && logDate <= end;
          if (!inDateRange) return false;

          // Filter by store if provided
          if (store && store !== "all") {
            return log["Prevádzka"] === store;
          }

          return true;
        });
      }

      const excelData = logs.map(log => ({
        "Kód zamestnanca": log["Kód"] || "",
        "Meno zamestnanca": log["Meno"] || "",
        "Dátum": log["dátum"] || "",
        "Čas": log["Original čas príchodu"] || "",
        "Zaokrúhlený čas": log["Zaokruhlený čas príchodu"] || "",
        "Akcia": log["Akcia"] || "",
        "Obed": log["Akcia"] === "Obed" ? "Áno" : "",
        "Trvanie dovolenky": log["Akcia"] === "Dovolenka" ? (log["Dovolenka (h)"] || log["Dĺžka"] || "") : "",
        "Prevádzka": log["Prevádzka"] || ""
      }));

      excelData.sort((a, b) => {
        const parseDateTime = (d: string, t: string) => {
          if (!d || !t) return 0;
          try {
            const [day, month, year] = d.split('.').map(Number);
            const [hh, mm, ss] = t.split(':').map(Number);
            if (isNaN(day) || isNaN(month) || isNaN(year) || isNaN(hh) || isNaN(mm)) return 0;
            return new Date(year, month - 1, day, hh, mm, ss || 0).getTime();
          } catch (e) {
            return 0;
          }
        };
        return parseDateTime(a["Dátum"], a["Čas"]) - parseDateTime(b["Dátum"], b["Čas"]);
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      XLSX.utils.book_append_sheet(wb, ws, "Dochádzka");
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const now = await getBratislavaTime();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `Vypis_Jednotlivo_${timestamp}.xlsx`;

      const result = await uploadExportFTP(fileName, buffer);
      return res.json(result);
    }

    // POST /api/export/summary
    if (url.includes('/api/export/summary') && method === 'POST') {
      const { startDate, endDate, store } = req.body;
      const dbData = await firestoreGet("Global", "Databaza") || {};
      const employees = await firestoreGet("Global", "Zamestnanci") || {};
      const logs = Object.values(dbData) as any[];

      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const filteredLogs = logs.filter(log => {
        const logDateParts = log["dátum"].split('.');
        if (logDateParts.length !== 3) return false;
        const logDate = new Date(Number(logDateParts[2]), Number(logDateParts[1]) - 1, Number(logDateParts[0]));
        
        // Filter by date
        const inDateRange = logDate >= start && logDate <= end;
        if (!inDateRange) return false;

        // Filter by store if provided
        if (store && store !== "all") {
          return log["Prevádzka"] === store;
        }

        return true;
      });

      const summary: Record<string, any> = {};
      const employeeLogsMap: Record<string, any[]> = {};

      filteredLogs.forEach(log => {
        const code = String(log["Kód"]);
        if (!employeeLogsMap[code]) employeeLogsMap[code] = [];
        employeeLogsMap[code].push(log);

        if (!summary[code]) {
          const rawMeno = employees[code] || log["Meno"] || "Neznámy";
          const storeMatch = rawMeno.match(/-\s*(.+)$/);
          const storeGroup = storeMatch ? storeMatch[1].trim() : "Ostatné";
          
          summary[code] = {
            code,
            meno: rawMeno,
            storeGroup,
            origSeconds: 0,
            roundSeconds: 0,
            lunches: 0,
            vacationHours: 0,
            days: {} 
          };
        }

        const s = summary[code];
        const logDate = log["dátum"];
        const day = logDate.split('.')[0];
        if (!s.days[day]) s.days[day] = [];

        if (log["Akcia"] === "Príchod" || log["Akcia"] === "arrival") {
          s.days[day].push("S");
        } else if (log["Akcia"] === "Obed" || log["Akcia"] === "lunch") {
          s.lunches++;
          s.days[day].push("O");
        } else if (log["Akcia"] === "Dovolenka" || log["Akcia"] === "vacation") {
          const dur = parseFloat(String(log["Dovolenka (h)"] || log["Dĺžka"] || "0"));
          s.vacationHours += dur;
          s.days[day].push("D");
        }
      });

      Object.keys(employeeLogsMap).forEach(code => {
        const empLogs = employeeLogsMap[code].sort((a, b) => {
          const parseDateTime = (d: string, t: string) => {
            const [day, month, year] = d.split('.').map(Number);
            const [hh, mm, ss] = (t || "00:00:00").split(':').map(Number);
            return new Date(year, month - 1, day, hh, mm, ss || 0).getTime();
          };
          const timeA = parseDateTime(a["dátum"], a["Original čas príchodu"]);
          const timeB = parseDateTime(b["dátum"], b["Original čas príchodu"]);
          return timeA - timeB;
        });

        const s = summary[code];
        if (!s) return;

        for (let i = 0; i < empLogs.length; i++) {
          const current = empLogs[i];
          if (current["Akcia"] === "Príchod" || current["Akcia"] === "arrival") {
            const next = empLogs.find((l, idx) => idx > i && (l["Akcia"] === "Odchod" || l["Akcia"] === "departure") && l["dátum"] === current["dátum"]);
            if (next) {
              const parseTime = (t: string) => {
                if (!t) return 0;
                const [h, m, sec] = t.split(':').map(Number);
                return (h || 0) * 3600 + (m || 0) * 60 + (sec || 0);
              };
              const currentOrigTime = parseTime(current["Original čas príchodu"]);
              const nextOrigTime = parseTime(next["Original čas príchodu"]);
              const diffOrig = nextOrigTime - currentOrigTime;
              if (diffOrig > 0) s.origSeconds += diffOrig;
              
              const currentRoundTimeStr = current["Zaokruhlený čas príchodu"];
              const nextRoundTimeStr = next["Zaokruhlený čas príchodu"];
              if (currentRoundTimeStr && nextRoundTimeStr) {
                const diffRound = parseTime(nextRoundTimeStr) - parseTime(currentRoundTimeStr);
                if (diffRound > 0) s.roundSeconds += diffRound;
              }
            }
          }
        }
      });

      const sortedEmployees = Object.values(summary).sort((a: any, b: any) => {
        if (a.storeGroup !== b.storeGroup) return a.storeGroup.localeCompare(b.storeGroup);
        return a.meno.localeCompare(b.meno);
      });

      const formatHours = (sec: number) => (sec / 3600).toFixed(2);

      const excelSummary = sortedEmployees.map((s: any) => ({
        "Kód zamestnanca": s.code,
        "Meno zamestnanca": s.meno,
        "Originálny čas": formatHours(s.origSeconds),
        "Zaokruhlený čas": formatHours(s.roundSeconds),
        "Obedy": s.lunches,
        "Dovolenka": s.vacationHours,
        "Spolu": (parseFloat(formatHours(s.roundSeconds)) + s.vacationHours).toFixed(2)
      }));

      const wb = XLSX.utils.book_new();
      const wsSum = XLSX.utils.json_to_sheet(excelSummary);
      XLSX.utils.book_append_sheet(wb, wsSum, "Súhrn");

      const daysInMonth = (month: number, year: number) => new Date(year, month, 0).getDate();
      const lastDay = daysInMonth(start.getMonth() + 1, start.getFullYear());
      const daysHeader = Array.from({ length: lastDay }, (_, i) => String(i + 1).padStart(2, '0'));
      
      const tableData = sortedEmployees.map((s: any) => {
        const row: any = { 
          "Meno zamestnanca": s.meno, 
          "Prevádzka": s.storeGroup 
        };
        
        daysHeader.forEach(d => {
          const dayLogs = s.days[d] || [];
          const uniqueLogs = Array.from(new Set(dayLogs));
          
          const displayParts: string[] = [];
          
          if (uniqueLogs.includes("S")) {
            const empLogs = employeeLogsMap[s.code] || [];
            const dayShiftLogs = empLogs.filter((l: any) => l["dátum"].split('.')[0] === d);
            
            let dayRoundSeconds = 0;
            const sortedDayLogs = dayShiftLogs.sort((a: any, b: any) => {
               const parseT = (t: string) => {
                 const timeStr = t || "00:00:00";
                 const [h, m, sec] = timeStr.split(':').map(Number);
                 return (h || 0) * 3600 + (m || 0) * 60 + (sec || 0);
               };
               return parseT(a["Original čas príchodu"]) - parseT(b["Original čas príchodu"]);
            });

            for (let i = 0; i < sortedDayLogs.length; i++) {
              const current = sortedDayLogs[i];
              if (current["Akcia"] === "Príchod" || current["Akcia"] === "arrival") {
                const next = sortedDayLogs.find((l: any, idx: number) => idx > i && (l["Akcia"] === "Odchod" || l["Akcia"] === "departure"));
                if (next && current["Zaokruhlený čas príchodu"] && next["Zaokruhlený čas príchodu"]) {
                  const parseT = (t: string) => {
                    const parts = t.split(':').map(Number);
                    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
                  };
                  const diff = parseT(next["Zaokruhlený čas príchodu"]) - parseT(current["Zaokruhlený čas príchodu"]);
                  if (diff > 0) dayRoundSeconds += diff;
                }
              }
            }
            if (dayRoundSeconds > 0) {
              const hours = (dayRoundSeconds / 3600).toFixed(2);
              displayParts.push(`S${hours}`);
            } else {
              displayParts.push("S");
            }
          }

          if (uniqueLogs.includes("O")) {
            displayParts.push("O");
          }

          if (uniqueLogs.includes("D")) {
            const empLogs = employeeLogsMap[s.code] || [];
            const dayVacLog = empLogs.find((l: any) => l["dátum"].split('.')[0] === d && (l["Akcia"] === "Dovolenka" || l["Akcia"] === "vacation"));
            const durRaw = dayVacLog ? (dayVacLog["Dovolenka (h)"] || dayVacLog["Dĺžka"] || "0") : "0";
            const dur = String(durRaw).replace(/[^0-9.]/g, '');
            if (dur && dur !== "0") {
              displayParts.push(`D${dur}`);
            } else if (uniqueLogs.includes("D")) {
               displayParts.push("D");
            }
          }

          row[d] = displayParts.join(',');
        });
        return row;
      });

      const wsTable = XLSX.utils.json_to_sheet(tableData, { 
        header: ["Meno zamestnanca", "Prevádzka", ...daysHeader] 
      });
      XLSX.utils.book_append_sheet(wb, wsTable, "Tabuľka dní");

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const now = await getBratislavaTime();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `Vypis_Spolu_${timestamp}.xlsx`;

      const result = await uploadExportFTP(fileName, buffer);
      return res.json(result);
    }

    // POST /api/uploads/ftp
    if (url.includes('/api/uploads/ftp') && method === 'POST') {
      const { name, base64Data, logId } = req.body;
      if (!name || !base64Data) {
        return res.status(400).json({ error: "Chýbajúce údaje" });
      }
      const result = await uploadPhotoFTP(name, base64Data, logId);
      return res.json(result);
    }

    // GET /api/stores/limits
    if (url.includes('/api/stores/limits') && method === 'GET') {
      const stores = await getStores();
      const limits: Record<string, string> = {};
      
      for (const store of stores) {
        const data = await firestoreGet(store, "Pocet");
        limits[store] = data?.Pocet || "0";
      }
      
      return res.json(limits);
    }

    // POST /api/stores/limits
    if (url.includes('/api/stores/limits') && method === 'POST') {
      const { store, limit } = req.body;
      if (!store) return res.status(400).json({ error: "Store name is required" });
      
      await firestoreSet(store, "Pocet", { Pocet: String(limit) });
      return res.json({ success: true });
    }

    // GET /api/stores/opening-hours
    if (url.includes('/api/stores/opening-hours') && method === 'GET') {
      const store = req.query.store as string;
      if (!store) return res.status(400).json({ error: "Store name is required" });
      
      const data = await firestoreGet(String(store), "Otvaracie_hodiny");
      return res.json(data || {});
    }

    // POST /api/stores/opening-hours
    if (url.includes('/api/stores/opening-hours') && method === 'POST') {
      const { store, hours } = req.body;
      if (!store || !hours) return res.status(400).json({ error: "Store and hours are required" });
      
      await firestoreSet(String(store), "Otvaracie_hodiny", hours);
      return res.json({ success: true });
    }

    // GET /api/stores/fix-opening-hours
    if (url.includes('/api/stores/fix-opening-hours') && method === 'GET') {
      const store = req.query.store as string;
      if (!store) return res.status(400).json({ error: "Store name is required" });
      
      const data = await firestoreGet(String(store), "Fix_Otvaracie");
      return res.json(data || {});
    }

    // POST /api/stores/fix-opening-hours
    if (url.includes('/api/stores/fix-opening-hours') && method === 'POST') {
      const { store, hours } = req.body;
      if (!store || !hours) return res.status(400).json({ error: "Store and hours are required" });
      
      await firestoreSet(String(store), "Fix_Otvaracie", hours);
      return res.json({ success: true });
    }

    // GET /api/stores/fix-closing-hours
    if (url.includes('/api/stores/fix-closing-hours') && method === 'GET') {
      const store = req.query.store as string;
      if (!store) return res.status(400).json({ error: "Store name is required" });
      
      const data = await firestoreGet(String(store), "Fix_Zatvaracie");
      return res.json(data || {});
    }

    // POST /api/stores/fix-closing-hours
    if (url.includes('/api/stores/fix-closing-hours') && method === 'POST') {
      const { store, hours } = req.body;
      if (!store || !hours) return res.status(400).json({ error: "Store and hours are required" });
      
      await firestoreSet(String(store), "Fix_Zatvaracie", hours);
      return res.json({ success: true });
    }

    // GET /api/attendance/active
    if (url.includes('/api/attendance/active') && method === 'GET') {
      const dbData = await firestoreGet("Global", "Databaza") || {};
      const logs = Object.values(dbData) as any[];
      
      const employeeLogsMap: Record<string, any[]> = {};
      
      const parseTime = (dateStr: string, timeStr: string) => {
        if (!dateStr || !timeStr) return 0;
        const [d, m, y] = dateStr.split('.').map(Number);
        const [hh, mm, ss] = timeStr.split(':').map(Number);
        return new Date(y, m - 1, d, hh, mm, ss || 0).getTime();
      };

      logs.forEach(log => {
        const code = String(log["Kód"]);
        if (!code || code === "undefined" || code === "null") return;
        if (!employeeLogsMap[code]) {
          employeeLogsMap[code] = [];
        }
        employeeLogsMap[code].push(log);
      });
      
      const activeEmployees: any[] = [];
      
      Object.keys(employeeLogsMap).forEach(code => {
        const employeeLogs = employeeLogsMap[code].sort((a, b) => {
          const timeB = parseTime(b["dátum"], b["Original čas príchodu"]);
          const timeA = parseTime(a["dátum"], a["Original čas príchodu"]);
          return timeB - timeA;
        });
        
        if (employeeLogs.length > 0) {
          const lastAttendanceLog = employeeLogs.find(l => 
            l["Akcia"] === "Príchod" || l["Akcia"] === "arrival" || 
            l["Akcia"] === "Odchod" || l["Akcia"] === "departure"
          );

          if (lastAttendanceLog && (lastAttendanceLog["Akcia"] === "Príchod" || lastAttendanceLog["Akcia"] === "arrival")) {
            activeEmployees.push({
              meno: lastAttendanceLog["Meno"],
              datum: lastAttendanceLog["dátum"],
              cas: lastAttendanceLog["Original čas príchodu"],
              zaokruhlenyCas: lastAttendanceLog["Zaokruhlený čas príchodu"],
              prevadzka: lastAttendanceLog["Prevádzka"]
            });
          }
        }
      });
        
      return res.json(activeEmployees);
    }

    // GET /api/attendance/overview
    if (url.includes('/api/attendance/overview') && method === 'GET') {
      const { from, to } = req.query;
      const dbData = await firestoreGet("Global", "Databaza") || {};
      const logs = Object.values(dbData) as any[];
      
      const parseDate = (dateStr: string) => {
        if (!dateStr) return 0;
        const [d, m, y] = dateStr.split('.').map(Number);
        return new Date(y, m - 1, d).getTime();
      };

      const parseTime = (dateStr: string, timeStr: string) => {
        if (!dateStr || !timeStr) return 0;
        const [d, m, y] = dateStr.split('.').map(Number);
        const [hh, mm, ss] = timeStr.split(':').map(Number);
        return new Date(y, m - 1, d, hh, mm, ss || 0).getTime();
      };

      const fromTime = from ? new Date(from as string).setHours(0,0,0,0) : 0;
      const toTime = to ? new Date(to as string).setHours(23,59,59,999) : Infinity;

      const filteredLogs = logs.filter(log => {
        const logTime = parseDate(log["dátum"]);
        return logTime >= fromTime && logTime <= toTime;
      }).sort((a, b) => {
        const timeB = parseTime(b["dátum"], b["Original čas príchodu"] || "00:00:00");
        const timeA = parseTime(a["dátum"], a["Original čas príchodu"] || "00:00:00");
        return timeB - timeA;
      });

      return res.json(filteredLogs);
    }

    // GET /api/attendance/lunches
    if (url.includes('/api/attendance/lunches') && method === 'GET') {
      const { code, from, to } = req.query;
      if (!code || !from || !to) {
        return res.status(400).json({ message: "Chýbajúce parametre" });
      }

      const dbData = await firestoreGet("Global", "Databaza") || {};
      const logs = Object.values(dbData) as any[];

      const fromDate = new Date(from as string);
      const toDate = new Date(to as string);
      toDate.setHours(23, 59, 59, 999);

      const filteredLunches = logs.filter(l => {
        if (String(l["Kód"]) !== String(code)) return false;
        if (l["Akcia"] !== "Obed") return false;

        const dateStr = String(l["dátum"]).trim();
        const parts = dateStr.split('.').map(p => p.trim());
        if (parts.length < 3) return false;
        
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        
        const logDate = new Date(year, month - 1, day);
        return logDate >= fromDate && logDate <= toDate;
      }).sort((a, b) => {
        const partsA = String(a["dátum"]).trim().split('.').map(p => p.trim());
        const partsB = String(b["dátum"]).trim().split('.').map(p => p.trim());
        const dateA = new Date(parseInt(partsA[2], 10), parseInt(partsA[1], 10) - 1, parseInt(partsA[0], 10));
        const dateB = new Date(parseInt(partsB[2], 10), parseInt(partsB[1], 10) - 1, parseInt(partsB[0], 10));
        return dateB.getTime() - dateA.getTime();
      });

      return res.json(filteredLunches);
    }

    // POST /api/verify-admin-code
    if (url.includes('/api/verify-admin-code') && method === 'POST') {
      const { code } = req.body;
      const adminCode = await getAdminCode();
      if (String(code) === String(adminCode)) {
        return res.json({ success: true });
      } else {
        return res.status(401).json({ message: "Nesprávny PIN kód" });
      }
    }

    // GET /api/admin-code
    if (url.includes('/api/admin-code') && method === 'GET') {
      const adminCode = await getAdminCode();
      return res.json({ adminCode });
    }

    // POST /api/admin-code (update admin code)
    if (url.includes('/api/admin-code') && method === 'POST') {
      const { newCode } = req.body;
      await firestoreSet("Global", "adminCode", { adminCode: newCode });
      return res.json({ success: true });
    }

    // GET /api/stores
    if (url === '/api/stores' && method === 'GET') {
      const stores = await getStores();
      return res.json(stores);
    }

    // GET /api/employees
    if (url === '/api/employees' && method === 'GET') {
      const employees = await firestoreGet("Global", "Zamestnanci");
      return res.json(employees || {});
    }

    // POST /api/employees/rename
    if (url.includes('/api/employees/rename') && method === 'POST') {
      const { code, newName } = req.body;
      if (!code || !newName) {
        return res.status(400).json({ error: "Chýbajúce údaje" });
      }

      const employeesData = await firestoreGet("Global", "Zamestnanci") || {};
      const trimmedCode = String(code).trim();
      
      let foundKey: string | null = null;
      for (const key of Object.keys(employeesData)) {
        if (key.trim() === trimmedCode || Number(key.trim()) === Number(trimmedCode)) {
          foundKey = key;
          break;
        }
      }

      if (!foundKey) {
        return res.status(404).json({ error: "Zamestnanec s týmto kódom neexistuje" });
      }

      employeesData[foundKey] = newName;
      await firestoreSet("Global", "Zamestnanci", employeesData);
      
      return res.json({ success: true, newName });
    }

    // POST /api/attendance/lunch
    if (url.includes('/api/attendance/lunch') && method === 'POST') {
      const { code, date, selectedStore, clientTimestamp } = req.body;
      const employeeName = await verifyEmployee(code);
      if (!employeeName) {
        return res.status(400).json({ message: "Neplatný kód zamestnanca" });
      }

      const dbData = await firestoreGet("Global", "Databaza") || {};
      const logs = Object.values(dbData) as any[];

      // Use client timestamp if provided, otherwise server Bratislava time
      const now = clientTimestamp ? new Date(clientTimestamp) : await getBratislavaTime();
      const formattedTime = new Intl.DateTimeFormat('sk-SK', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(now);

      const [y, m, d] = date.split('-');
      const dNum = parseInt(d, 10);
      const mNum = parseInt(m, 10);
      
      const possibleFormats = [
        `${d}. ${m}. ${y}`,
        `${dNum}. ${mNum}. ${y}`,
        `${dNum}. ${m}. ${y}`,
        `${d}.${m}.${y}`,
        `${dNum}.${mNum}.${y}`,
        `${dNum}. ${mNum}. ${y}`,
        `${d}. ${mNum}. ${y}`,
        `${d}.${mNum}.${y}`,
      ];

      const workLog = logs.find(l => {
        const logDate = String(l["dátum"] || "").trim().replace(/\s+/g, ' ');
        const logAction = String(l["Akcia"] || "").trim();
        const logCode = String(l["Kód"] || "").trim();
        return logCode === String(code) && 
          possibleFormats.some(f => logDate === f.replace(/\s+/g, ' ')) && 
          (logAction === "Príchod" || logAction === "arrival");
      });

      if (!workLog) {
        return res.status(400).json({ message: "ERR_NOT_WORKED" });
      }

      const lunchLog = logs.find(l => {
        const logDate = String(l["dátum"] || "").trim().replace(/\s+/g, ' ');
        const logAction = String(l["Akcia"] || "").trim();
        const logCode = String(l["Kód"] || "").trim();
        return logCode === String(code) && 
          possibleFormats.some(f => logDate === f.replace(/\s+/g, ' ')) && 
          (logAction === "Obed" || logAction === "lunch");
      });

      if (lunchLog) {
        return res.status(400).json({ message: "ERR_ALREADY_HAD_LUNCH" });
      }

      const arrivalStore = workLog["Prevádzka"];
      const currentStore = selectedStore || "Neznáma prevádzka";
      if (arrivalStore && arrivalStore !== currentStore) {
        return res.status(400).json({ message: `ERR_WRONG_STORE:${arrivalStore}` });
      }

      const logId = `log_${new Date().getTime()}`;
      const prevadzka = selectedStore || "Neznáma prevádzka";
      const finalSlovakDate = possibleFormats[0]; 
      
      dbData[logId] = {
        "Kód": code,
        "Meno": employeeName,
        "dátum": finalSlovakDate,
        "Original čas príchodu": formattedTime,
        "Zaokruhlený čas príchodu": "",
        "Akcia": "Obed",
        "Prevádzka": prevadzka,
        "Foto": ""
      };
      
      await firestoreSet("Global", "Databaza", dbData);

      return res.status(201).json({ success: true, meno: employeeName });
    }

    // POST /api/attendance/vacation
    if (url.includes('/api/attendance/vacation') && method === 'POST') {
      const { code, date, duration, selectedStore, overwrite } = req.body;
      const employeeName = await verifyEmployee(code);
      if (!employeeName) {
        return res.status(400).json({ message: "Neplatný kód zamestnanca" });
      }

      const dbData = await firestoreGet("Global", "Databaza") || {};
      
      const [y, m, d] = date.split('-');
      const slovakDate = `${d}. ${m}. ${y}`;

      if (!overwrite) {
        const existingLog = Object.entries(dbData).find(([_, log]: [string, any]) => 
          log["Kód"] === code && 
          log["dátum"] === slovakDate && 
          log["Akcia"] === "Dovolenka"
        );

        if (existingLog) {
          return res.status(409).json({ message: "ERR_ALREADY_HAD_VACATION" });
        }
      } else {
        Object.keys(dbData).forEach(key => {
          const log = dbData[key];
          if (log["Kód"] === code && log["dátum"] === slovakDate && log["Akcia"] === "Dovolenka") {
            delete dbData[key];
          }
        });
      }

      const logId = `log_${new Date().getTime()}`;
      
      dbData[logId] = {
        "Kód": code,
        "Meno": employeeName,
        "dátum": slovakDate,
        "Original čas príchodu": "",
        "Zaokruhlený čas príchodu": "",
        "Akcia": "Dovolenka",
        "Dovolenka (h)": `${duration} hod`,
        "Prevádzka": "",
        "Foto": ""
      };
      
      await firestoreSet("Global", "Databaza", dbData);
      return res.status(201).json({ success: true, meno: employeeName });
    }

    // DELETE /api/attendance/vacation
    if (url.includes('/api/attendance/vacation') && method === 'DELETE') {
      const dbData = await firestoreGet("Global", "Databaza") || {};
      const newData: Record<string, any> = {};
      
      Object.keys(dbData).forEach(key => {
        if (dbData[key]["Akcia"] !== "Dovolenka") {
          newData[key] = dbData[key];
        }
      });
      
      await firestoreSet("Global", "Databaza", newData);
      return res.json({ success: true });
    }

    // GET /api/settings
    if (url.includes('/api/settings') && method === 'GET') {
      return res.json({});
    }

    // POST /api/settings
    if (url.includes('/api/settings') && method === 'POST') {
      return res.json({ success: true });
    }

    // GET /api/attendance/overview
    if (url.includes('/api/attendance/overview') && method === 'GET') {
      const parsedUrl = new URL(url, `http://${req.headers.host || 'localhost'}`);
      const from = parsedUrl.searchParams.get('from');
      const to = parsedUrl.searchParams.get('to');
      const store = parsedUrl.searchParams.get('store');

      const dbData = await firestoreGet("Global", "Databaza") || {};
      const logs = Object.values(dbData) as any[];

      const parseDate = (dateStr: string) => {
        if (!dateStr) return 0;
        const [d, m, y] = dateStr.split('.').map(Number);
        return new Date(y, m - 1, d).getTime();
      };

      const fromTime = from ? new Date(from as string).setHours(0,0,0,0) : 0;
      const toTime = to ? new Date(to as string).setHours(23,59,59,999) : Infinity;

      const filteredLogs = logs.filter(log => {
        const logDateStr = String(log["dátum"] || "").trim();
        const logTime = parseDate(logDateStr);
        
        // Filter by date
        const inDateRange = logTime >= fromTime && logTime <= toTime;
        if (!inDateRange) return false;

        // Filter by store if provided
        if (store && store !== "all") {
          const logStore = String(log["Prevádzka"] || "").trim().toLowerCase();
          const targetStore = String(store).trim().toLowerCase();
          return logStore === targetStore;
        }

        return true;
      }).sort((a, b) => {
        const parseTime = (dateStr: string, timeStr: string) => {
          if (!dateStr || !timeStr) return 0;
          const [d, m, y] = dateStr.split('.').map(Number);
          const [hh, mm, ss] = timeStr.split(':').map(Number);
          return new Date(y, m - 1, d, hh, mm, ss || 0).getTime();
        };
        const timeB = parseTime(b["dátum"], b["Original čas príchodu"] || "00:00:00");
        const timeA = parseTime(a["dátum"], a["Original čas príchodu"] || "00:00:00");
        return timeB - timeA;
      });

      return res.json(filteredLogs);
    }

    // GET /api/attendance (list)
    if (url === '/api/attendance' && method === 'GET') {
      return res.json([]);
    }

    // POST /api/attendance (create)
    if (url === '/api/attendance' && method === 'POST') {
      const { selectedStore, photoPath, clientTimestamp, code, type, isManual } = req.body;
      
      const log = await createAttendanceLog({ code, type, selectedStore, photoPath, clientTimestamp, isManual });
      return res.status(201).json(log);
    }

    // POST /api/attendance/delete-range
    if (url.includes('/api/attendance/delete-range') && method === 'POST') {
      const { startDate, endDate, store } = req.body;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "Chýba dátum od alebo do" });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const dbData = await firestoreGet("Global", "Databaza") || {};
      const newData: Record<string, any> = {};
      let deletedCount = 0;

      Object.keys(dbData).forEach(key => {
        const log = dbData[key];
        const action = log["Akcia"];
        
        if (action === "Príchod" || action === "arrival" || action === "Odchod" || action === "departure") {
          const logDateParts = String(log["dátum"]).split('.');
          if (logDateParts.length >= 3) {
            const day = parseInt(logDateParts[0].trim(), 10);
            const month = parseInt(logDateParts[1].trim(), 10);
            const year = parseInt(logDateParts[2].trim(), 10);
            const logDate = new Date(year, month - 1, day);
            
            if (logDate >= start && logDate <= end) {
              if (store === "all" || log["Prevádzka"] === store) {
                deletedCount++;
                return;
              }
            }
          }
        }
        newData[key] = log;
      });

      await firestoreSet("Global", "Databaza", newData);
      return res.json({ success: true, deletedCount });
    }

    // POST /api/lunch/delete-range
    if (url.includes('/api/lunch/delete-range') && method === 'POST') {
      const { startDate, endDate, store } = req.body;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "Chýba dátum od alebo do" });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const dbData = await firestoreGet("Global", "Databaza") || {};
      const newData: Record<string, any> = {};
      let deletedCount = 0;

      Object.keys(dbData).forEach(key => {
        const log = dbData[key];
        const action = log["Akcia"];
        
        if (action === "Obed" || action === "lunch") {
          const logDateParts = String(log["dátum"]).split('.');
          if (logDateParts.length >= 3) {
            const day = parseInt(logDateParts[0].trim(), 10);
            const month = parseInt(logDateParts[1].trim(), 10);
            const year = parseInt(logDateParts[2].trim(), 10);
            const logDate = new Date(year, month - 1, day);
            
            if (logDate >= start && logDate <= end) {
              if (store === "all" || log["Prevádzka"] === store) {
                deletedCount++;
                return;
              }
            }
          }
        }
        newData[key] = log;
      });

      await firestoreSet("Global", "Databaza", newData);
      return res.json({ success: true, deletedCount });
    }

    // POST /api/vacation/delete-range
    if (url.includes('/api/vacation/delete-range') && method === 'POST') {
      const { startDate, endDate, store } = req.body;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "Chýba dátum od alebo do" });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const dbData = await firestoreGet("Global", "Databaza") || {};
      const newData: Record<string, any> = {};
      let deletedCount = 0;

      Object.keys(dbData).forEach(key => {
        const log = dbData[key];
        const action = log["Akcia"];
        
        if (action === "Dovolenka" || action === "vacation") {
          const logDateParts = String(log["dátum"]).split('.');
          if (logDateParts.length >= 3) {
            const day = parseInt(logDateParts[0].trim(), 10);
            const month = parseInt(logDateParts[1].trim(), 10);
            const year = parseInt(logDateParts[2].trim(), 10);
            const logDate = new Date(year, month - 1, day);
            
            if (logDate >= start && logDate <= end) {
              if (store === "all" || log["Prevádzka"] === store) {
                deletedCount++;
                return;
              }
            }
          }
        }
        newData[key] = log;
      });

      await firestoreSet("Global", "Databaza", newData);
      return res.json({ success: true, deletedCount });
    }

    return res.status(404).json({ error: "Not found" });
  } catch (error: any) {
    console.error("API Error:", error);
    return res.status(400).json({ message: error.message, field: "code" });
  }
}
