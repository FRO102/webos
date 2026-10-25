import { kv } from './storage.js';

const DEFAULT_USER = { id: 'user', name: 'User', avatar: 'U' };
let users = [];
let current = null;

export async function initUsers() {
  users = [DEFAULT_USER];
  await kv.set('system:users', users);
  sessionStorage.setItem('webos:user', DEFAULT_USER.id);
  current = DEFAULT_USER;
}

export const getUsers = () => users.map(user => ({ ...user }));
export const getCurrentUser = () => current ? { ...current } : null;

export async function selectUser(id) {
  const user = id === DEFAULT_USER.id ? DEFAULT_USER : null;
  if (!user) throw new Error('Utilizador não encontrado.');
  current = user;
  sessionStorage.setItem('webos:user', user.id);
  return { ...user };
}

export async function createUser(name) {
  throw new Error('O WebOS está configurado para usar apenas o perfil User.');
}

export function clearSessionUser() {
  sessionStorage.removeItem('webos:user');
  current = null;
}
