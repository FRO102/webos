import { kv } from './storage.js';

const DEFAULT_USER = { id: 'user', name: 'Utilizador', avatar: 'U' };
let users = [];
let current = null;

export async function initUsers() {
  users = await kv.get('system:users');
  if (!Array.isArray(users) || !users.length) {
    users = [DEFAULT_USER];
    await kv.set('system:users', users);
  }
  const id = sessionStorage.getItem('webos:user') || users[0].id;
  current = users.find(user => user.id === id) || users[0];
}

export const getUsers = () => users.map(user => ({ ...user }));
export const getCurrentUser = () => current ? { ...current } : null;

export async function selectUser(id) {
  const user = users.find(item => item.id === id);
  if (!user) throw new Error('Utilizador não encontrado.');
  current = user;
  sessionStorage.setItem('webos:user', user.id);
  return { ...user };
}

export async function createUser(name) {
  const clean = String(name ?? '').trim().slice(0, 32);
  if (!clean) throw new Error('Indica um nome para o utilizador.');
  const id = clean.toLocaleLowerCase('pt').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `user-${Date.now()}`;
  if (users.some(user => user.id === id)) throw new Error('Esse utilizador já existe.');
  const user = { id, name: clean, avatar: clean[0].toUpperCase() };
  users.push(user);
  await kv.set('system:users', users);
  return { ...user };
}

export function clearSessionUser() {
  sessionStorage.removeItem('webos:user');
  current = null;
}
