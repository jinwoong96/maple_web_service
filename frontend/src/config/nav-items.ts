import {
  Bell,
  Calculator,
  Coins,
  Dices,
  Home,
  Shield,
  ShieldUser,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  title: string
  to: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { title: '홈', to: '/', icon: Home },
  { title: '유니온', to: '/union', icon: Users },
  { title: '길드', to: '/guild', icon: Shield },
  { title: '길드 관리', to: '/guild-admin', icon: ShieldUser },
  { title: '연무장', to: '/battle-practice', icon: Swords },
  { title: '랭킹', to: '/ranking', icon: Trophy },
  { title: '확률 정보', to: '/probability', icon: Dices },
  { title: '결정석 계산기', to: '/boss-revenue', icon: Coins },
  { title: '분배금 계산기', to: '/boss-profit', icon: Calculator },
  { title: '알림', to: '/notifications', icon: Bell },
]
