import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import {
  Box,
  Flex,
  Heading,
  IconButton,
  useColorMode,
  useColorModeValue,
  VStack,
  Tooltip,
  FormControl,
  FormLabel,
  Switch
} from '@chakra-ui/react';
import { SunIcon, MoonIcon, ViewIcon, SettingsIcon, QuestionOutlineIcon, TimeIcon, CopyIcon } from '@chakra-ui/icons';

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

const Sidebar = () => {
  const sidebarBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const activeLinkStyle = {
    backgroundColor: useColorModeValue('blue.100', 'blue.800'),
    color: useColorModeValue('blue.500', 'white'),
  };

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
      zIndex="sticky"
    >
      <VStack p={2} spacing={4} align="center" mt={4}>
         <Box boxSize="40px" mb={4}>
           {/* // a simple shield icon */}
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 0h24v24H0V0z" fill="none"/>
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" fill="#4299E1"/>
           </svg>
         </Box>

        <Tooltip label="Dashboard" placement="right">
          <IconButton
            as={NavLink}
            to="/"
            end // // 'end' prop ensures it's only active for the exact path
            _activeLink={activeLinkStyle}
            aria-label="Dashboard"
            icon={<TimeIcon />}
            variant="ghost"
            fontSize="20px"
          />
        </Tooltip>
        
        <Tooltip label="Firewall Status" placement="right">
          <IconButton
            as={NavLink}
            to="/status"
            _activeLink={activeLinkStyle}
            aria-label="Firewall Status"
            icon={<ViewIcon />}
            variant="ghost"
            fontSize="20px"
          />
        </Tooltip>

        <Tooltip label="Generated Reports" placement="right">
          <IconButton
            as={NavLink}
            to="/reports"
            _activeLink={activeLinkStyle}
            aria-label="Generated Reports"
            icon={<CopyIcon />}
            variant="ghost"
            fontSize="20px"
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


const Layout = () => {
  const bg = useColorModeValue('gray.50', 'gray.900');
  const [isTestMode, setIsTestMode] = useState(false);

  return (
    <Flex minH="100vh" bg={bg}>
      <Sidebar />
      <Box ml="60px" w="full" p={6}>
        <Flex justify="space-between" align="center" mb={6}>
          <Heading as="h1" size="lg">
            pfSense Log Analyzer
          </Heading>
          <Flex align="center">
            <FormControl display="flex" alignItems="center" w="auto" mr={4}>
                <FormLabel htmlFor="test-mode-switch" mb="0" mr={3}>
                    Test Mode
                </FormLabel>
                <Switch 
                    colorScheme="blue" 
                    id="test-mode-switch" 
                    isChecked={isTestMode} 
                    onChange={(e) => setIsTestMode(e.target.checked)} 
                />
            </FormControl>
            <ColorModeSwitcher />
          </Flex>
        </Flex>
        {/* // Child routes will get isTestMode via context */}
        <Outlet context={{ isTestMode }} />
      </Box>
    </Flex>
  );
};

export default Layout;