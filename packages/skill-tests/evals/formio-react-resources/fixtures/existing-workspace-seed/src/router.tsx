import { Outlet, createBrowserRouter } from 'react-router';
import { requireUser, resourceRoutes, rootLoader } from './formio';
import { customer } from './resources/customer/config';

const customerRoutes = resourceRoutes(customer);

export const router = createBrowserRouter([
  {
    path: '/',
    id: 'root',
    loader: rootLoader,
    children: [
      {
        // Pathless layout route: adds no URL segment, protects everything below it.
        id: 'protected',
        loader: requireUser(),
        element: <Outlet />,
        children: [{ path: customer.routePath, children: customerRoutes }],
      },
    ],
  },
]);
