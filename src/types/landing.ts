export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: string;
  level: "local" | "national" | "international";
  year?: number;
}

export interface Category {
  id: string;
  name: string;
  nameEn?: string;
  icon?: string;
}

export interface Recognition {
  id: string;
  name: string;
  type: "competition" | "test" | "award";
}

export interface Ranking {
  id: string;
  title: string;
  level: "elementary" | "middle" | "high" | "school" | "achievement";
  students?: string[];
  school?: string;
  achievement?: string;
}

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon?: string;
  href: string;
}
