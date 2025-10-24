// Size table utilities for roster editor

export interface RosterItem {
  size: string;
  number: number | string;
  name?: string;
}

export interface SizeCount {
  size: string;
  qty: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: { row: number; field: string; message: string }[];
  duplicateNumbers: number[];
}

// Size presets
export const presetAlpha = ["XS", "S", "M", "L", "XL", "XXL"];
export const presetNumeric = ["116", "128", "140", "152", "164", "S", "M", "L", "XL", "XXL"];

// Generate roster items from size counts
export function makeRosterFromCounts(counts: SizeCount[]): RosterItem[] {
  const items: RosterItem[] = [];
  
  counts.forEach(({ size, qty }) => {
    for (let i = 0; i < qty; i++) {
      items.push({
        size,
        number: "",
        name: "",
      });
    }
  });
  
  return items;
}

// Auto-assign jersey numbers starting from a given number
export function assignJerseyNumbers(items: RosterItem[], startNumber: number = 1): RosterItem[] {
  return items.map((item, index) => ({
    ...item,
    number: startNumber + index,
  }));
}

// Validate roster items
export function validateRoster(
  items: RosterItem[],
  allowDuplicates: boolean = false,
  minNumber: number = 0,
  maxNumber: number = 99
): ValidationResult {
  const errors: { row: number; field: string; message: string }[] = [];
  const numberMap = new Map<number, number[]>();
  
  items.forEach((item, index) => {
    // Validate size
    if (!item.size || item.size.trim() === "") {
      errors.push({
        row: index,
        field: "size",
        message: "Größe ist erforderlich",
      });
    }
    
    // Validate number
    const num = typeof item.number === "string" ? parseInt(item.number) : item.number;
    
    if (item.number === "" || item.number === null || item.number === undefined) {
      errors.push({
        row: index,
        field: "number",
        message: "Nummer ist erforderlich",
      });
    } else if (isNaN(num)) {
      errors.push({
        row: index,
        field: "number",
        message: "Nummer muss eine Zahl sein",
      });
    } else if (num < minNumber || num > maxNumber) {
      errors.push({
        row: index,
        field: "number",
        message: `Nummer muss zwischen ${minNumber} und ${maxNumber} liegen`,
      });
    } else {
      // Track duplicates
      if (!numberMap.has(num)) {
        numberMap.set(num, []);
      }
      numberMap.get(num)!.push(index);
    }
    
    // Validate name length
    if (item.name && item.name.length > 30) {
      errors.push({
        row: index,
        field: "name",
        message: "Name darf maximal 30 Zeichen lang sein",
      });
    }
  });
  
  // Find duplicate numbers
  const duplicateNumbers: number[] = [];
  numberMap.forEach((rows, num) => {
    if (rows.length > 1) {
      duplicateNumbers.push(num);
      if (!allowDuplicates) {
        rows.forEach((rowIndex) => {
          errors.push({
            row: rowIndex,
            field: "number",
            message: `Nummer ${num} ist bereits vergeben`,
          });
        });
      }
    }
  });
  
  return {
    ok: errors.length === 0,
    errors,
    duplicateNumbers,
  };
}

// Get counts by size from roster items
export function getCountsBySize(items: RosterItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  
  items.forEach((item) => {
    if (item.size) {
      counts[item.size] = (counts[item.size] || 0) + 1;
    }
  });
  
  return counts;
}

// Parse CSV content
export function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.trim().split("\n");
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }
  
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map((line) => line.split(",").map((cell) => cell.trim()));
  
  return { headers, rows };
}

// Convert CSV rows to roster items
export function csvToRoster(
  headers: string[],
  rows: string[][],
  columnMap: { size?: number; number?: number; name?: number }
): RosterItem[] {
  const items: RosterItem[] = [];
  
  rows.forEach((row) => {
    const item: RosterItem = {
      size: columnMap.size !== undefined ? row[columnMap.size] || "" : "",
      number: columnMap.number !== undefined ? row[columnMap.number] || "" : "",
      name: columnMap.name !== undefined ? row[columnMap.name] || "" : "",
    };
    
    // Only add if at least size or number is present
    if (item.size || item.number) {
      items.push(item);
    }
  });
  
  return items;
}

// Convert roster items to CSV
export function rosterToCSV(items: RosterItem[]): string {
  const lines = ["size,number,name"];
  
  items.forEach((item) => {
    lines.push(`${item.size},${item.number},${item.name || ""}`);
  });
  
  return lines.join("\n");
}

// Download CSV file
export function downloadCSV(content: string, filename: string = "roster.csv") {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
