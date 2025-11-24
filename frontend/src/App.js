import React from 'react';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout';
import MainDashboard from './pages/MainDashboard';
import HostStatusPage from './pages/HostStatusPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage'; 
import HostFormPage from './pages/HostFormPage'; 
import { LanguageProvider } from './context/LanguageContext';

const theme = extendTheme({
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
  colors: {
    gray: {
      50: '#ffffff',  
      100: '#F5F5F5',
      200: '#E5E5E5',
      300: '#D4D4D4',
      400: '#A3A3A3',
      500: '#737373',
      600: '#525252',
      700: 'whiteAlpha.400', 
      800: '#191919',   
      900: '#191919',   
    },
  },
  components: {
    Select: {
      variants: {
        outline: {
          field: {
            _dark: {
              bg: 'gray.800',
              borderColor: 'gray.700',
            },
          },
        },
      },
    },
  },
  styles: {
    global: (props) => ({
      body: {
        color: props.colorMode === 'dark' ? 'whiteAlpha.900' : 'gray.800',
      },
    }),
  },
});

// Define routes using the Data Router object structure
const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <MainDashboard />,
      },
      {
        path: "status",
        element: <HostStatusPage />,
      },
      {
        path: "status/add",
        element: <HostFormPage />,
      },
      {
        path: "status/edit/:hostId",
        element: <HostFormPage />,
      },
      {
        path: "reports",
        element: <ReportsPage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
    ],
  },
]);

function App() {
  return (
    <ChakraProvider theme={theme}>
      <LanguageProvider>
        <RouterProvider router={router} />
      </LanguageProvider>
    </ChakraProvider>
  );
}

export default App;