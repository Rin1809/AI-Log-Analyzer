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

// Override theme de loai bo mau xanh (Slate) mac dinh cua Chakra UI
const theme = extendTheme({
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
  colors: {
    gray: {
      50: '#FAFAFA',  
      100: '#F4F4F5',
      200: '#E4E4E7',
      300: '#D4D4D8',
      400: '#A1A1AA',
      500: '#71717A',
      600: '#52525B',
      700: '#333333', // Neutral Dark Gray (Thay cho Slate Blue)
      800: '#1F1F1F', // Neutral Darker Gray (Dung cho Menu/Card)
      900: '#121212', // Almost Black (Dung cho Body Background)
    },
  },
  components: {
    Select: {
      variants: {
        outline: {
          field: {
            _dark: {
              bg: 'gray.800',
              borderColor: 'gray.600',
            },
          },
        },
      },
    },
    // Fix mau nen cho Menu va Modal trong Dark Mode
    Menu: {
      baseStyle: (props) => ({
        list: {
          bg: props.colorMode === 'dark' ? 'gray.800' : 'white',
          borderColor: props.colorMode === 'dark' ? 'gray.700' : 'gray.200',
        },
        item: {
          _focus: {
            bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.100',
          },
          _hover: {
            bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.100',
          },
        },
      }),
    },
    Modal: {
      baseStyle: (props) => ({
        dialog: {
          bg: props.colorMode === 'dark' ? 'gray.800' : 'white',
        },
      }),
    },
  },
  styles: {
    global: (props) => ({
      body: {
        bg: props.colorMode === 'dark' ? 'gray.900' : 'gray.50',
        color: props.colorMode === 'dark' ? 'whiteAlpha.900' : 'gray.800',
      },
    }),
  },
});

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