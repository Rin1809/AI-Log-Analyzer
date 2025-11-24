import React from 'react';
import { NavLink, Link as RouterLink } from 'react-router-dom';
import { Box, VStack, Tooltip, IconButton, useColorModeValue } from '@chakra-ui/react';
import { ViewIcon, CopyIcon, SettingsIcon, QuestionOutlineIcon, CheckCircleIcon } from '@chakra-ui/icons';
import { useLanguage } from '../../context/LanguageContext'; 

const Logo = () => (
<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="40px" height="40px"><g clip-path="url(#prefix__clip0_5_13)" fill-rule="evenodd" clip-rule="evenodd"><path d="M211.648 89.515h-76.651A57.707 57.707 0 0077.291 147.2v242.389a57.707 57.707 0 0057.706 57.707h242.411a57.707 57.707 0 0057.707-57.707V288.128l34.624-23.744v125.227a92.35 92.35 0 01-92.331 92.33H134.997a92.349 92.349 0 01-92.33-92.33v-242.39A92.336 92.336 0 0169.702 81.92a92.33 92.33 0 0165.295-27.05h96.96l-20.309 34.645z"/><path d="M380.16 0c3.093 0 5.717 2.219 6.379 5.248a149.328 149.328 0 0040.533 74.325 149.332 149.332 0 0074.347 40.555c3.029.661 5.248 3.285 5.248 6.4a6.574 6.574 0 01-5.248 6.357 149.338 149.338 0 00-74.326 40.555 149.338 149.338 0 00-40.789 75.413 6.334 6.334 0 01-6.144 5.078 6.334 6.334 0 01-6.144-5.078 149.338 149.338 0 00-40.789-75.413 149.326 149.326 0 00-75.414-40.789 6.338 6.338 0 01-5.077-6.144c0-2.987 2.133-5.547 5.077-6.144a149.336 149.336 0 0075.414-40.79 149.354 149.354 0 0040.554-74.325A6.573 6.573 0 01380.16 0z"/></g><defs><clipPath id="prefix__clip0_5_13"><path fill="#fff" d="M0 0h512v512H0z"/></clipPath></defs></svg>
);

const Sidebar = () => {
  const sidebarBg = useColorModeValue('gray.50', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const activeLinkStyle = {
    backgroundColor: useColorModeValue('blue.50', 'blue.900'),
    color: useColorModeValue('blue.600', 'white'),
  };
  
  const { t } = useLanguage(); 

  const navItems = [
    { label: t('dashboard'), to: '/', icon: <ViewIcon />, end: true }, // Changed to ViewIcon (Dashboard)
    { label: t('hostStatus'), to: '/status', icon: <CheckCircleIcon /> }, // Changed to CheckCircleIcon (Status)
    { label: t('generatedReports'), to: '/reports', icon: <CopyIcon /> },
    { label: t('settings'), to: '/settings', icon: <SettingsIcon />, disabled: false },
    { label: t('help'), to: '#', icon: <QuestionOutlineIcon />, disabled: true },
  ];

  return (
    <Box as="nav" pos="fixed" top="0" left="0" h="100vh" w="80px" bg={sidebarBg} borderRight="1px" borderColor={borderColor} zIndex="sticky">
      <VStack p={2} spacing={5} align="center" mt={4}>
        {/* Clickable Logo redirecting to Dashboard */}
        <Box 
            as={RouterLink} 
            to="/" 
            boxSize="40px" 
            mb={4} 
            _hover={{ opacity: 0.8, transform: 'scale(1.05)' }} 
            transition="all 0.2s"
        >
            <Logo />
        </Box>

        {navItems.map((item) => (
          <Tooltip key={item.to} label={item.label} placement="right" hasArrow bg="gray.600" color="white">
            <IconButton
              as={item.disabled ? 'button' : NavLink}
              to={item.to}
              end={item.end ? "true" : undefined}
              _activeLink={activeLinkStyle}
              aria-label={item.label}
              icon={item.icon}
              variant="ghost"
              fontSize="20px"
              isDisabled={item.disabled}
            />
          </Tooltip>
        ))}
      </VStack>
    </Box>
  );
};

export default Sidebar;