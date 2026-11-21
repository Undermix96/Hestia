import { useState } from 'react';
import { RouterProvider } from 'react-router';
import { DataSourceProvider } from '../api/datasource/context';
import type { DataSource } from '../api/datasource/types';
import { AppMotionConfig } from './motion';
import { createAppRouter } from './router';

export function App({ dataSource }: { dataSource: DataSource }) {
  const [router] = useState(() => createAppRouter());
  return (
    <DataSourceProvider value={dataSource}>
      <AppMotionConfig>
        <RouterProvider router={router} />
      </AppMotionConfig>
    </DataSourceProvider>
  );
}
