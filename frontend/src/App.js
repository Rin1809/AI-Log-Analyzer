import React from 'react';
import {
  ChakraProvider,
  Box,
  Container,
  Flex,
  Heading,
  IconButton,
  useColorMode,
  useColorModeValue,
  extendTheme,
} from '@chakra-ui/react';
import { SunIcon, MoonIcon } from '@chakra-ui/icons';
import Dashboard from './Dashboard';

// // custom theme de mac dinh la dark mode
const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
});

const ColorModeSwitcher = (props) => {
  const { toggleColorMode } = useColorMode();
  const text = useColorModeValue('dark', 'light');
  const SwitchIcon = useColorModeValue(MoonIcon, SunIcon);

  return (
    <IconButton
      size="md"
      fontSize="lg"
      aria-label={`Switch to ${text} mode`}
      variant="ghost"
      color="current"
      marginLeft="2"
      onClick={toggleColorMode}
      icon={<SwitchIcon />}
      {...props}
    />
  );
};


function App() {
  const bg = useColorModeValue('gray.50', 'gray.800');
  const headerBg = useColorModeValue('white', 'gray.900');
  const color = useColorModeValue('gray.800', 'white');

  return (
    <ChakraProvider theme={theme}>
      <Box bg={bg} color={color} minH="100vh">
        <Box bg={headerBg} boxShadow="sm" py={3}>
          <Container maxW="container.xl">
            <Flex justify="space-between" align="center">
              <Heading as="h1" size="lg">
                Pfsense Log Analyzer Dashboard
              </Heading>
              <ColorModeSwitcher />
            </Flex>
          </Container>
        </Box>
        <Container maxW="container.xl" pt={6} pb={8}>
          <Dashboard />
        </Container>
      </Box>
    </ChakraProvider>
  );
}

export default App;