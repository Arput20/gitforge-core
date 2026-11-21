export interface Repo {
  id: number;
  owner: string;
  name: string;
  description: string;
  private: boolean;
  defaultBranch: string;
  createdAt: string;
  refs: Map<string, string>;
  objects: Map<string, { type: string; bytes: Uint8Array }>;
  labels: Map<string, string>;
  issues: Issue[];
  pulls: Pull[];
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  comments: Comment[];
  user: { login: string };
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: number;
  body: string;
  user: { login: string };
  createdAt: string;
}

export interface Pull {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  comments: Comment[];
  user: { login: string };
  createdAt: string;
  updatedAt: string;
  head: { ref: string };
  base: { ref: string };
  merged: boolean;
  mergeable: boolean;
}

export class Store {
  repos: Map<string, Repo> = new Map();
}

export const store = new Store();
