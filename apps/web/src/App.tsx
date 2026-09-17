import { RouterProvider } from 'react-router-dom';
import { router } from './routes/index.tsx';
import InstallBanner from './components/InstallBanner.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
      <InstallBanner />
    </ErrorBoundary>
  );
}
