'use client'

import type { LucideProps } from 'lucide-react'
import {
  Briefcase, Code, Pen, BookOpen, Camera,
  Music, Palette, Globe, Home, Star,
  Heart, Zap, Target, Flag, Rocket,
  Coffee, Laptop, Phone, Mail, Calendar,
  Clock, Folder, Archive, Bookmark, Tag,
  Search, Wrench, Scissors, Layout, Grid,
  List, CheckSquare, FileText, Image, Video,
  Mic, Headphones, Lightbulb, Award, Shield,
} from 'lucide-react'
import type { FC } from 'react'

export const ICON_NAMES = [
  'Briefcase', 'Code', 'Pen', 'BookOpen', 'Camera',
  'Music', 'Palette', 'Globe', 'Home', 'Star',
  'Heart', 'Zap', 'Target', 'Flag', 'Rocket',
  'Coffee', 'Laptop', 'Phone', 'Mail', 'Calendar',
  'Clock', 'Folder', 'Archive', 'Bookmark', 'Tag',
  'Search', 'Wrench', 'Scissors', 'Layout', 'Grid',
  'List', 'CheckSquare', 'FileText', 'Image', 'Video',
  'Mic', 'Headphones', 'Lightbulb', 'Award', 'Shield',
] as const

export type IconName = typeof ICON_NAMES[number]

export const ICON_MAP: Record<IconName, FC<LucideProps>> = {
  Briefcase, Code, Pen, BookOpen, Camera,
  Music, Palette, Globe, Home, Star,
  Heart, Zap, Target, Flag, Rocket,
  Coffee, Laptop, Phone, Mail, Calendar,
  Clock, Folder, Archive, Bookmark, Tag,
  Search, Wrench, Scissors, Layout, Grid,
  List, CheckSquare, FileText, Image, Video,
  Mic, Headphones, Lightbulb, Award, Shield,
}

interface TaskGroupIconProps {
  name: string
  size?: number
  className?: string
}

export function TaskGroupIcon({ name, size = 20, className = '' }: TaskGroupIconProps) {
  const IconComp = ICON_MAP[name as IconName]
  if (!IconComp) return null
  return <IconComp size={size} className={className} />
}
