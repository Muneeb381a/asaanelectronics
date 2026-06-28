import { RouterProvider } from 'react-router-dom';
import { router } from './routes/index.tsx';
import InstallBanner from './components/InstallBanner.tsx';

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <InstallBanner />
    </>
  );
}
