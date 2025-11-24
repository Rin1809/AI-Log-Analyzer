import React from 'react';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Box, Flex, useColorModeValue, IconButton, useColorMode,
  HStack, Breadcrumb, BreadcrumbItem, BreadcrumbLink, Text, Icon,
  Menu, MenuButton, MenuList, MenuItem, Button
} from '@chakra-ui/react';
import { SunIcon, MoonIcon, ChevronRightIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { useLanguage } from '../../context/LanguageContext';

const Logo = () => (
<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="28px" height="28px"><g clip-path="url(#prefix__clip0_5_13)" fill-rule="evenodd" clip-rule="evenodd">
    <path d="M211.648 89.515h-76.651A57.707 57.707 0 0077.291 147.2v242.389a57.707 57.707 0 0057.706 57.707h242.411a57.707 57.707 0 0057.707-57.707V288.128l34.624-23.744v125.227a92.35 92.35 0 01-92.331 92.33H134.997a92.349 92.349 0 01-92.33-92.33v-242.39A92.336 92.336 0 0169.702 81.92a92.33 92.33 0 0165.295-27.05h96.96l-20.309 34.645z"/>
    <path d="M380.16 0c3.093 0 5.717 2.219 6.379 5.248a149.328 149.328 0 0040.533 74.325 149.332 149.332 0 0074.347 40.555c3.029.661 5.248 3.285 5.248 6.4a6.574 6.574 0 01-5.248 6.357 149.338 149.338 0 00-74.326 40.555 149.338 149.338 0 00-40.789 75.413 6.334 6.334 0 01-6.144 5.078 6.334 6.334 0 01-6.144-5.078 149.338 149.338 0 00-40.789-75.413 149.326 149.326 0 00-75.414-40.789 6.338 6.338 0 01-5.077-6.144c0-2.987 2.133-5.547 5.077-6.144a149.336 149.336 0 0075.414-40.79 149.354 149.354 0 0040.554-74.325A6.573 6.573 0 01380.16 0z"/></g><defs><clipPath id="prefix__clip0_5_13"><path fill="#fff" d="M0 0h512v512H0z"/></clipPath></defs></svg>
);

const ColorModeSwitcher = () => {
  const { toggleColorMode } = useColorMode();
  const SwitchIcon = useColorModeValue(MoonIcon, SunIcon);
  return (
    <IconButton size="sm" fontSize="lg" aria-label={`Switch color mode`} variant="ghost" color="current" onClick={toggleColorMode} icon={<SwitchIcon />} />
  );
};

const getBreadcrumbs = (pathname, t) => {
  const paths = pathname.split('/').filter(Boolean);
  if (paths.length === 0) return [{ label: t('dashboard'), to: '/' }];

  const breadcrumbs = [];
  if (paths[0] === 'status') {
    breadcrumbs.push({ label: t('modules'), isCurrent: false });
    breadcrumbs.push({ label: t('hostStatus'), to: '/status', isCurrent: paths.length === 1 });
    if (paths[1] === 'add') breadcrumbs.push({ label: t('add'), isCurrent: true });
    else if (paths[1] === 'edit') breadcrumbs.push({ label: t('edit'), isCurrent: true });
  } else if (paths[0] === 'reports') {
    breadcrumbs.push({ label: t('modules'), isCurrent: false });
    breadcrumbs.push({ label: t('generatedReports'), to: '/reports', isCurrent: true });
  } else if (paths[0] === 'settings') {
    breadcrumbs.push({ label: t('management'), isCurrent: false });
    breadcrumbs.push({ label: t('settings'), to: '/settings', isCurrent: true });
  } else {
    breadcrumbs.push({ label: 'Page', isCurrent: false });
    breadcrumbs.push({ label: paths[0].charAt(0).toUpperCase() + paths[0].slice(1), isCurrent: true });
  }
  return breadcrumbs;
};

const Header = () => {
  const location = useLocation();
  const { language, setLanguage, t } = useLanguage(); 
  const breadcrumbs = getBreadcrumbs(location.pathname, t);

  const headerBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.600', 'gray.400');
  const activeColor = useColorModeValue('gray.800', 'white');

  const langLabels = { vi: 'Tiếng Việt', en: 'English', ja: '日本語' };

  return (
    <Box as="header" position="sticky" top="0" zIndex="10" bg={headerBg} px={6} h={14} borderBottomWidth="1px" borderColor={borderColor} shadow="sm">
      <Flex h="100%" alignItems="center" justifyContent="space-between">
        <HStack spacing={2} alignItems="center">
          
          {/* Clickable Brand Area (Logo + Name) */}
          <HStack 
            spacing={1} 
            pr={4} 
            borderRight="1px solid" 
            borderColor={borderColor} 
            mr={2}
            as={RouterLink}
            to="/"
            _hover={{ textDecoration: 'none', opacity: 0.8 }}
            cursor="pointer"
            userSelect="none"
          >
             <Logo />
             <Text fontWeight="normal" fontSize="2xl" letterSpacing="tight" display={{base: 'none', md: 'block'}} color={activeColor}>
                AI Log Analyzer<Text as="span" color="blue.400">.</Text>
             </Text>
             <Icon as={ChevronRightIcon} color="gray.400" />
          </HStack>

          <Breadcrumb separator="/" fontSize="sm" fontWeight="medium" color={textColor} display={{base: 'none', md: 'block'}}>
            {breadcrumbs.map((item, index) => (
              <BreadcrumbItem key={index} isCurrentPage={item.isCurrent}>
                {item.to && !item.isCurrent ? (
                   <BreadcrumbLink as={RouterLink} to={item.to} _hover={{ textDecoration: 'none', color: activeColor }}>
                     {item.label}
                   </BreadcrumbLink>
                ) : (
                   <Text color={item.isCurrent ? activeColor : 'inherit'}>{item.label}</Text>
                )}
              </BreadcrumbItem>
            ))}
          </Breadcrumb>
        </HStack>

        <Flex alignItems="center" gap={2}>
           {/* Language Switcher */}
           <Menu>
            <MenuButton as={Button} rightIcon={<ChevronDownIcon />} size="xs" variant="outline" fontWeight="normal">
                {langLabels[language]}
            </MenuButton>
            <MenuList minW="120px" zIndex={1500}>
                <MenuItem onClick={() => setLanguage('vi')}>🇻🇳 Tiếng Việt</MenuItem>
                <MenuItem onClick={() => setLanguage('en')}>🇺🇸 English</MenuItem>
                <MenuItem onClick={() => setLanguage('ja')}>🇯🇵 日本語</MenuItem>
            </MenuList>
           </Menu>
          <ColorModeSwitcher />
        </Flex>
      </Flex>
    </Box>
  );
};

export default Header;