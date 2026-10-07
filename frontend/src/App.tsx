import { Route, Routes } from 'react-router'

import { AppLayout } from '@/components/layout/app-layout'
import { BattlePracticePage } from '@/pages/battle-practice-page'
import { BossProfitPage } from '@/pages/boss-profit-page'
import { BossRevenuePage } from '@/pages/boss-revenue-page'
import { CharacterDetailPage } from '@/pages/character-detail-page'
import { DevOcrPage } from '@/pages/dev-ocr-page'
import { GuildAdminPage } from '@/pages/guild-admin-page'
import { GuildPage } from '@/pages/guild-page'
import { HomePage } from '@/pages/home-page'
import { NotificationsPage } from '@/pages/notifications-page'
import { ProbabilityPage } from '@/pages/probability-page'
import { RankingPage } from '@/pages/ranking-page'
import { UnionPage } from '@/pages/union-page'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="characters/:characterName" element={<CharacterDetailPage />} />
        <Route path="union" element={<UnionPage />} />
        <Route path="guild" element={<GuildPage />} />
        <Route path="guild-admin" element={<GuildAdminPage />} />
        <Route path="battle-practice" element={<BattlePracticePage />} />
        <Route path="ranking" element={<RankingPage />} />
        <Route path="probability" element={<ProbabilityPage />} />
        <Route path="boss-revenue" element={<BossRevenuePage />} />
        <Route path="boss-profit" element={<BossProfitPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        {/* OCR 점검 화면. 개발 빌드에서만 붙인다 — 서비스 기능이 아니라
            인식이 왜 틀렸는지 들여다보는 도구다. */}
        {import.meta.env.DEV && <Route path="dev/ocr" element={<DevOcrPage />} />}
      </Route>
    </Routes>
  )
}

export default App
