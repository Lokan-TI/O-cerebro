import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ErpCrmDashboard from './pages/ErpCrmDashboard.jsx';
import GerenciarFontes from './pages/GerenciarFontes.jsx';
import ConversasLeads from './pages/ConversasLeads.jsx';
import Integracoes from './pages/Integracoes.jsx';
import ConversaoNovosClientes from './pages/ConversaoNovosClientes.jsx';
import BrainHome from './pages/BrainHome.jsx';
import PainelDecisao from './pages/PainelDecisao.jsx';
import GrowthMarketing from './pages/GrowthMarketing.jsx';
import ProjecaoLongoPrazo from './pages/ProjecaoLongoPrazo.jsx';
import AtivosCustos from './pages/AtivosCustos.jsx';
import DetalhamentoFinanceiro from './pages/DetalhamentoFinanceiro.jsx';
import RdStationCallback from './pages/RdStationCallback.jsx';
import FluxosEmail from './pages/FluxosEmail.jsx';
import { ErpSourceProvider } from '@/lib/ErpSourceContext';
import { ErpSnapshotProvider } from '@/lib/ErpSnapshotContext';
import { EmpresaFilterProvider } from '@/lib/EmpresaFilterContext';
import { GlobalFilterProvider } from '@/lib/GlobalFilterContext';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <ErpSourceProvider>
    <ErpSnapshotProvider>
    <EmpresaFilterProvider>
    <GlobalFilterProvider>
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName="BrainHome">
          <BrainHome />
        </LayoutWrapper>
      } />
      <Route path="/BrainHome" element={
        <LayoutWrapper currentPageName="BrainHome">
          <BrainHome />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/ErpCrmDashboard" element={
        <LayoutWrapper currentPageName="ErpCrmDashboard">
          <ErpCrmDashboard />
        </LayoutWrapper>
      } />
      <Route path="/ConversaoNovosClientes" element={
        <LayoutWrapper currentPageName="ConversaoNovosClientes">
          <ConversaoNovosClientes />
        </LayoutWrapper>
      } />
      <Route path="/PainelDecisao" element={
        <LayoutWrapper currentPageName="PainelDecisao">
          <PainelDecisao />
        </LayoutWrapper>
      } />
      <Route path="/GrowthMarketing" element={
        <LayoutWrapper currentPageName="GrowthMarketing">
          <GrowthMarketing />
        </LayoutWrapper>
      } />
      <Route path="/ProjecaoLongoPrazo" element={
        <LayoutWrapper currentPageName="ProjecaoLongoPrazo">
          <ProjecaoLongoPrazo />
        </LayoutWrapper>
      } />
      <Route path="/AtivosCustos" element={
        <LayoutWrapper currentPageName="AtivosCustos">
          <AtivosCustos />
        </LayoutWrapper>
      } />
      <Route path="/DetalhamentoFinanceiro" element={
        <LayoutWrapper currentPageName="DetalhamentoFinanceiro">
          <DetalhamentoFinanceiro />
        </LayoutWrapper>
      } />
      <Route path="/FluxosEmail" element={
        <LayoutWrapper currentPageName="FluxosEmail">
          <FluxosEmail />
        </LayoutWrapper>
      } />
      <Route path="/Integracoes" element={
        <LayoutWrapper currentPageName="Integracoes">
          <Integracoes />
        </LayoutWrapper>
      } />
      <Route path="/ConversasLeads" element={
        <LayoutWrapper currentPageName="ConversasLeads">
          <ConversasLeads />
        </LayoutWrapper>
      } />
      <Route path="/GerenciarFontes" element={
        <LayoutWrapper currentPageName="GerenciarFontes">
          <GerenciarFontes />
        </LayoutWrapper>
      } />
      <Route path="/rdstation/callback" element={
        <LayoutWrapper currentPageName="RdStationCallback">
          <RdStationCallback />
        </LayoutWrapper>
      } />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </GlobalFilterProvider>
    </EmpresaFilterProvider>
    </ErpSnapshotProvider>
    </ErpSourceProvider>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App