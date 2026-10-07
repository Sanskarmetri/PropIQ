import { Route, Routes } from 'react-router-dom';
import { ScrollToTop } from './components/ScrollToTop.jsx';
import { MainLayout } from './layouts/MainLayout.jsx';
import { AnalyticsPage } from './pages/AnalyticsPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { ExplorePage } from './pages/ExplorePage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { PropertyDetailsPage } from './pages/PropertyDetailsPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { ValuationPage } from './pages/ValuationPage.jsx';

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="explore" element={<ExplorePage />} />
          <Route path="properties/:id" element={<PropertyDetailsPage />} />
          <Route path="valuation" element={<ValuationPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}
