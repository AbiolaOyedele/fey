import {
  Briefcase, Code, Pen, BookOpen, Camera,
  Music, Palette, Globe, Home, Star,
  Heart, Zap, Target, Flag, Rocket,
  Coffee, Laptop, Phone, Mail, Calendar,
  Clock, Folder, Archive, Bookmark, Tag,
  Search, Wrench, Scissors, Layout, Grid,
  List, CheckSquare, FileText, Image, Video,
  Mic, Headphones, Lightbulb, Award, Shield,
} from 'lucide-react';

export const ICON_NAMES = [
  'Briefcase', 'Code', 'Pen', 'BookOpen', 'Camera',
  'Music', 'Palette', 'Globe', 'Home', 'Star',
  'Heart', 'Zap', 'Target', 'Flag', 'Rocket',
  'Coffee', 'Laptop', 'Phone', 'Mail', 'Calendar',
  'Clock', 'Folder', 'Archive', 'Bookmark', 'Tag',
  'Search', 'Wrench', 'Scissors', 'Layout', 'Grid',
  'List', 'CheckSquare', 'FileText', 'Image', 'Video',
  'Mic', 'Headphones', 'Lightbulb', 'Award', 'Shield',
];

export const ICON_MAP = {
  Briefcase, Code, Pen, BookOpen, Camera,
  Music, Palette, Globe, Home, Star,
  Heart, Zap, Target, Flag, Rocket,
  Coffee, Laptop, Phone, Mail, Calendar,
  Clock, Folder, Archive, Bookmark, Tag,
  Search, Wrench, Scissors, Layout, Grid,
  List, CheckSquare, FileText, Image, Video,
  Mic, Headphones, Lightbulb, Award, Shield,
};

export function TaskGroupIcon({ name, size = 20, className = '' }) {
  const IconComp = ICON_MAP[name];
  if (!IconComp) return null;
  return <IconComp size={size} className={className} />;
}
