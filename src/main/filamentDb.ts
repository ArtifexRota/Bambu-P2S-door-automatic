import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface Filament {
  id: string;
  brand: string;
  material: string;
  colorName: string;
  colorHex: string;
  startWeight: number;
  remainingWeight: number;
  price?: number;
  purchaseDate?: string;
  serialNumber?: string;
}

let dbPath = '';

export function initFilamentDb() {
  const userDataPath = app.getPath('userData');
  dbPath = path.join(userDataPath, 'filaments.json');

  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify([]), 'utf-8');
  }
}

export function getFilaments(): Filament[] {
  try {
    const data = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading filaments db:', error);
    return [];
  }
}

export function saveFilaments(filaments: Filament[]) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(filaments, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing filaments db:', error);
  }
}

export function addFilament(filament: Omit<Filament, 'id'>): Filament {
  const filaments = getFilaments();
  const newFilament: Filament = {
    ...filament,
    id: Date.now().toString() + Math.random().toString(36).substring(2, 5)
  };
  filaments.push(newFilament);
  saveFilaments(filaments);
  return newFilament;
}

export function updateFilament(id: string, updates: Partial<Filament>): Filament | null {
  const filaments = getFilaments();
  const index = filaments.findIndex(f => f.id === id);
  
  if (index !== -1) {
    filaments[index] = { ...filaments[index], ...updates };
    saveFilaments(filaments);
    return filaments[index];
  }
  return null;
}

export function deleteFilament(id: string): void {
  const filaments = getFilaments();
  const filtered = filaments.filter(f => f.id !== id);
  saveFilaments(filtered);
}
