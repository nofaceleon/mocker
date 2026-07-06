import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/projects" replace /> },
      {
        path: 'projects',
        lazy: () => import('@/pages/ProjectsPage').then((m) => ({ Component: m.ProjectsPage })),
      },
      {
        path: 'projects/:projectId',
        lazy: () =>
          import('@/pages/ProjectDetailPage').then((m) => ({ Component: m.ProjectDetailPage })),
      },
      {
        path: 'projects/:projectId/apis/new',
        lazy: () => import('@/pages/ApiEditPage').then((m) => ({ Component: m.ApiEditPage })),
      },
      {
        path: 'projects/:projectId/apis/:apiId',
        lazy: () => import('@/pages/ApiEditPage').then((m) => ({ Component: m.ApiEditPage })),
      },
      {
        path: 'callbacks',
        lazy: () =>
          import('@/pages/CallbackTasksPage').then((m) => ({ Component: m.CallbackTasksPage })),
      },
      {
        path: 'data',
        lazy: () => import('@/pages/DataPage').then((m) => ({ Component: m.DataPage })),
      },
      {
        path: 'logs',
        lazy: () => import('@/pages/LogsPage').then((m) => ({ Component: m.LogsPage })),
      },
      {
        path: 'settings',
        lazy: () => import('@/pages/SettingsPage').then((m) => ({ Component: m.SettingsPage })),
      },
    ],
  },
]);

export { router };
