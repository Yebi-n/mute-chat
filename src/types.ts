export type MainTab = 'promotion' | 'member' | 'concept' | 'region' | 'adult';

export type Room = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  memberCount: number;
  maxMembers: number;
  region?: string;
  category: 'general' | 'member' | 'concept';
  topSpaceCount: number;
  isAdult?: boolean;
  isPrivate?: boolean;
  isPromoted?: boolean;
  isActive?: boolean;
  emoji: string;
  imageColor: string;
  coverUri?: string;
  updatedAt?: number;
};
