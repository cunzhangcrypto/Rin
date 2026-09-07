import type { ReactNode } from "react";
import { lazy, Suspense, useContext, useLayoutEffect } from "react"; // 使用 useLayoutEffect 确保在渲染前锁定标题
import type { DefaultParams, PathPattern } from "wouter";
import { Route, Switch } from "wouter";
import { AdminLayout } from "../components/admin-layout";
import Footer from "../components/footer";
import { Header } from "../components/header";
import { Padding } from "../components/padding";
import { getHeaderLayoutDefinition } from "../components/site-header/layout-registry";
import { Tips, TipsPage } from "../components/tips";
import useTableOfContents from "../hooks/useTableOfContents";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { AdminRecommendPage } from "../page/admin-recommend";
import { CallbackPage } from "../page/callback";
import { CompatTasksPage } from "../page/compat-tasks";
import { ErrorPage } from "../page/error";
import { TOCHeader } from "../components/toc-header";
import { FeedsPage } from "../page/feeds";
import { FriendsPage } from "../page/friends";
import { GeoPage } from "../page/geo";
import { HealthPage } from "../page/health";
import { HashtagPage } from "../page/hashtag";
import { HashtagsPage } from "../page/hashtags";
import { LoginPage } from "../page/login";
import { ProfilePage } from "../page/profile";
import { QueueStatusPage } from "../page/queue-status";
import { SearchPage } from "../page/search";
import { Settings } from "../page/settings";
import { TimelinePage } from "../page/timeline";
import { ProfileContext } from "../state/profile";
import { tryInt } from "../utils/int";
import { useTranslation } from "react-i18next";

// 重页面按需懒加载：文章页(mermaid+Markdown)、动态、写作页(monaco+mermaid)
// 移出首包，进入对应路由时才加载，首页首包显著变小，功能与路由行为完全不变。
const LazyFeedPage = lazy(() => import("../page/feed").then((m) => ({ default: m.FeedPage })));
const LazyMomentsPage = lazy(() => import("../page/moments").then((m) => ({ default: m.MomentsPage })));
const LazyWritingPage = lazy(() => import("../page/writing").then((m) => ({ default: m.WritingPage })));

export function AppRoutes() {
  const { t } = useTranslation();

  return (
    <Suspense fallback={<div className="w-full min-h-[40vh] flex items-center justify-center text-sm t-secondary">Loading…</div>}>
    <Switch>
      <AppRoute path="/">
        <FeedsPage />
      </AppRoute>

      <AppRoute path="/timeline">
        <TimelinePage />
      </AppRoute>

      <AppRoute path="/moments">
        <LazyMomentsPage />
      </AppRoute>

      <AppRoute path="/friends">
        <FriendsPage />
      </AppRoute>

      <AppRoute path="/geo">
        <GeoPage />
      </AppRoute>

      <AppRoute path="/hashtags">
        <HashtagsPage />
      </AppRoute>

      <AppRoute path="/hashtag/:name">
        {(params) => <HashtagPage name={params.name || ""} />}
      </AppRoute>

      <AppRoute path="/search/:keyword">
        {(params) => <SearchPage keyword={params.keyword || ""} />}
      </AppRoute>

      <AdminRoute path="/admin/settings" requirePermission title={t("settings.title")} description={t("admin.settings_description")}>
        <Settings />
      </AdminRoute>

      <AdminRoute path="/admin/health" requirePermission title={t("health.title")} description={t("admin.health_description")}>
        <HealthPage />
      </AdminRoute>

      <AdminRoute path="/admin/queue-status" requirePermission title={t("queue_status.title")} description={t("admin.queue_status_description")}>
        <QueueStatusPage />
      </AdminRoute>

      <AdminRoute path="/admin/compat-tasks" requirePermission title={t("compat_tasks.title")} description={t("admin.compat_tasks_description")}>
        <CompatTasksPage />
      </AdminRoute>

      <AdminRoute path="/admin/recommend" requirePermission title={t("recommend.manage")} description={t("admin.recommend_description")}>
        <AdminRecommendPage />
      </AdminRoute>

      <AdminRoute path="/admin/writing" requirePermission title={t("writing")} description={t("admin.writing_description")}>
        <LazyWritingPage />
      </AdminRoute>

      <AdminRoute path="/admin/writing/:id" requirePermission title={t("writing")} description={t("admin.writing_description")}>
        {({ id }) => <LazyWritingPage id={tryInt(0, id)} />}
      </AdminRoute>

      <AppRoute path="/callback">
        <CallbackPage />
      </AppRoute>

      <AppRoute path="/login">
        <LoginPage />
      </AppRoute>

      <AppRoute path="/profile">
        <ProfilePage />
      </AppRoute>

      <TocRoute path="/feed/:id">
        {(params, toc, cleanup) => <LazyFeedPage id={params.id || ""} TOC={toc} clean={cleanup} />}
      </TocRoute>

      <TocRoute path="/:alias">
        {(params, toc, cleanup) => <LazyFeedPage id={params.alias || ""} TOC={toc} clean={cleanup} />}
      </TocRoute>

      <AppRoute path="/user/github">
        <TipsPage>
          <Tips value={t("error.api_url")} type="error" />
        </TipsPage>
      </AppRoute>

      <AppRoute path="/*/user/github">
        <TipsPage>
          <Tips value={t("error.api_url_slash")} type="error" />
        </TipsPage>
      </AppRoute>

      <AppRoute path="/user/github/callback">
        <TipsPage>
          <Tips value={t("error.github_callback")} type="error" />
        </TipsPage>
      </AppRoute>

      <AppRoute>
        <ErrorPage error={t("error.not_found")} />
      </AppRoute>
    </Switch>
    </Suspense>
  );
}

function AppRoute({
  path,
  children,
  headerComponent,
  paddingClassName,
  requirePermission,
}: {
  path?: PathPattern;
  children: ReactNode | ((params: DefaultParams) => ReactNode);
  headerComponent?: ReactNode;
  paddingClassName?: string;
  requirePermission?: boolean;
}) {
  const profile = useContext(ProfileContext);
  const siteConfig = useSiteConfig();
  const { t } = useTranslation();

  useLayoutEffect(() => {
    const targetTitle = (window as any).SEO_TITLE;
    
    if ((path === "/" || window.location.pathname === "/") && targetTitle) {
      if (document.title !== targetTitle) {
        document.title = targetTitle;
      }
  
      const observer = new MutationObserver(() => {
        if (document.title !== targetTitle) {
          document.title = targetTitle;
        }
      });

      const titleNode = document.querySelector('title');
      if (titleNode) {
        observer.observe(titleNode, { childList: true });
      }

      return () => observer.disconnect();
    }
  }, [path]);

  const content =
    requirePermission && !profile?.permission ? <ErrorPage error={t("error.permission_denied")} /> : children;

  return (
    <Route path={path}>
      {(params) => {
        const resolvedContent = typeof content === "function" ? content(params) : content;
        const layoutDefinition = getHeaderLayoutDefinition(siteConfig.headerLayout);

      // routes.tsx 里的 AppRoute 组件渲染部分 (约 175 行)

       return layoutDefinition.renderRouteShell({
          header: <Header>{headerComponent}</Header>,
          content: (
            <div className="relative">
              
              {/* 左侧精致挂件区：全站显示 */}
              <aside className="hidden 2xl:block absolute w-[240px] z-10" 
                     style={{ 
                       top: '170px', 
                       left: 'calc(50% - 750px)' 
                     }}>
                <div className="transform scale-95 origin-top-left">
                  <Padding mode="left" />
                </div>
              </aside>

              {/* 💡 增加：右侧挂件，仅在首页 (path === "/") 显示 */}
              {path === "/" && (
                <aside className="hidden 2xl:block absolute w-[280px] z-10" 
                       style={{ 
                         top: '150px', 
                         left: 'calc(50% + 490px)' 
                       }}>
                  <div className="transform scale-95 origin-top-left">
                    <Padding mode="right" />
                  </div>
                </aside>
              )}

              {/* 中间内容区 */}
              <Padding className={paddingClassName}>
                {resolvedContent}
              </Padding>

            </div>
          ),
          footer: <Footer />,
          paddingClassName,
        });
      }}
    </Route>
  );
}

function AdminRoute({
  path,
  children,
  requirePermission,
  title,
  description,
}: {
  path: PathPattern;
  children: ReactNode | ((params: DefaultParams) => ReactNode);
  requirePermission?: boolean;
  title: string;
  description: string;
}) {
  const profile = useContext(ProfileContext);
  const { t } = useTranslation();
  const content =
    requirePermission && !profile?.permission ? <ErrorPage error={t("error.permission_denied")} /> : children;

  return (
    <Route path={path}>
      {(params) => (
        <AdminLayout title={title} description={description}>
          {typeof content === "function" ? content(params) : content}
        </AdminLayout>
      )}
    </Route>
  );
}

function TocRoute({
  path,
  children,
}: {
  path: PathPattern;
  children: (params: DefaultParams, toc: () => JSX.Element, cleanup: (id: string) => void) => ReactNode;
}) {
  const { TOC, cleanup } = useTableOfContents(".toc-content");

  return (
    <AppRoute path={path} headerComponent={TOCHeader({ TOC })} paddingClassName="mx-4">
      {(params) => children(params, TOC, cleanup)}
    </AppRoute>
  );
}