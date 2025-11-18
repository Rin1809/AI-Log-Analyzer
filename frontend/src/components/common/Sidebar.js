import React from 'react';
import { NavLink } from 'react-router-dom';
import { Box, VStack, Tooltip, IconButton, useColorModeValue } from '@chakra-ui/react';
import { TimeIcon, ViewIcon, CopyIcon, SettingsIcon, QuestionOutlineIcon } from '@chakra-ui/icons';


const Logo = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="40px" height="40px" viewBox="0 0 256 256">
        <path fill="#000000ff" d="M128 24a104 104 0 1 0 104 104A104.12 104.12 0 0 0 128 24Zm-21.23 74.77a8 8 0 0 1 11.31 0L128 108.69l9.9-9.9a8 8 0 0 1 11.31 11.31L139.31 120l9.9 9.9a8 8 0 0 1-11.31 11.31L128 131.31l-9.9 9.9a8 8 0 0 1-11.31-11.31L116.69 120l-9.9-9.9a8 8 0 0 1 0-11.32Z"/>
        <path fill="#000000ff" d="m181.23 109.23l-11.32-11.31a8 8 0 0 0-11.31 11.31L168.5 120l-9.9 9.9a8 8 0 0 0 11.31 11.31l11.32-11.32a8 8 0 0 0 0-11.32ZM74.77 109.23a8 8 0 0 0-11.31 0l-11.32 11.32a8 8 0 0 0 0 11.32l11.32 11.31a8 8 0 0 0 11.31-11.31L64.89 120l9.88-9.9a8 8 0 0 0 0-11.32Z"/>
    </svg>
);


const Sidebar = () => {
  const sidebarBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const activeLinkStyle = {
    backgroundColor: useColorModeValue('blue.50', 'blue.900'),
    color: useColorModeValue('blue.600', 'white'),
  };

  const navItems = [
    { label: 'Dashboard', to: '/', icon: <TimeIcon />, end: true },
    { label: 'Host Status', to: '/status', icon: <ViewIcon /> },
    { label: 'Generated Reports', to: '/reports', icon: <CopyIcon /> },
    { label: 'Settings (coming soon)', to: '#', icon: <SettingsIcon />, disabled: true },
    { label: 'Help (coming soon)', to: '#', icon: <QuestionOutlineIcon />, disabled: true },
  ];

  return (
    <Box
      as="nav"
      pos="fixed"
      top="0"
      left="0"
      h="100vh"
      w="80px" // // fix: tang chieu rong
      bg={sidebarBg}
      borderRight="1px"
      borderColor={borderColor}
      zIndex="sticky"
    >
      <VStack p={2} spacing={5} align="center" mt={4}> {/* // fix: tang spacing */}
        <Box boxSize="40px" mb={4}>
           <Logo />
        </Box>

        {navItems.map((item) => (
          <Tooltip key={item.label} label={item.label} placement="right">
            <IconButton
              as={item.disabled ? 'button' : NavLink}
              to={item.to}
              end={item.end}
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