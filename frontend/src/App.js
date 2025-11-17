import React from 'react';
import {
  ChakraProvider,
  Box,
  Flex,
  Heading,
  IconButton,
  useColorMode,
  useColorModeValue,
  extendTheme,
  VStack,
  Tooltip,
  Text
} from '@chakra-ui/react';
import { SunIcon, MoonIcon, ViewIcon, SettingsIcon, QuestionOutlineIcon } from '@chakra-ui/icons';
import Dashboard from './Dashboard';

// // custom theme de mac dinh la dark mode
const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
});

const Sidebar = () => {
  const sidebarBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Box
      as="nav"
      pos="fixed"
      top="0"
      left="0"
      h="100vh"
      w="60px"
      bg={sidebarBg}
      borderRight="1px"
      borderColor={borderColor}
      boxShadow="md"
    >
      <VStack p={2} spacing={4} align="center" mt={4}>
         <Box boxSize="40px" mb={4}>
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 0h24v24H0V0z" fill="none"/>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#4299E1"/>
           </svg>
         </Box>
        <Tooltip label="Dashboard" placement="right">
          <IconButton
            aria-label="Dashboard"
            icon={<ViewIcon />}
            variant="ghost"
            fontSize="20px"
            colorScheme='blue'
            isActive={true} // // tam thoi de active
          />
        </Tooltip>
        <Tooltip label="Settings (coming soon)" placement="right">
          <IconButton
            aria-label="Settings"
            icon={<SettingsIcon />}
            variant="ghost"
            fontSize="20px"
            isDisabled
          />
        </Tooltip>
        <Tooltip label="Help (coming soon)" placement="right">
          <IconButton
            aria-label="Help"
            icon={<QuestionOutlineIcon />}
            variant="ghost"
            fontSize="20px"
            isDisabled
          />
        </Tooltip>
      </VStack>
    </Box>
  );
};

const ColorModeSwitcher = (props) => {
  const { toggleColorMode } = useColorMode();
  const SwitchIcon = useColorModeValue(MoonIcon, SunIcon);

  return (
    <IconButton
      size="md"
      fontSize="lg"
      aria-label={`Switch color mode`}
      variant="ghost"
      color="current"
      onClick={toggleColorMode}
      icon={<SwitchIcon />}
      {...props}
    />
  );
};


function App() {
  const bg = useColorModeValue('gray.50', 'gray.900');

  return (
    <ChakraProvider theme={theme}>
      <Flex minH="100vh" bg={bg}>
        <Sidebar />
        <Box ml="60px" w="full" p={6}>
          <Flex justify="space-between" align="center" mb={6}>
            <Heading as="h1" size="lg">
              pfSense Log Analyzer
            </Heading>
            <ColorModeSwitcher />
          </Flex>
          <Dashboard />
        </Box>
      </Flex>
    </ChakraProvider>
  );
}

export default App;