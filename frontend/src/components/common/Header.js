import React from 'react';
import {
  Box,
  Flex,
  Heading,
  FormControl,
  FormLabel,
  Switch,
  useColorModeValue,
  IconButton,
  useColorMode,
  HStack,
  Text,
} from '@chakra-ui/react';
import { SunIcon, MoonIcon } from '@chakra-ui/icons';


const Logo = () => (
<svg fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="32px" height="32px"><g clip-path="url(#prefix__clip0_5_13)" fill-rule="evenodd" clip-rule="evenodd" fill="#000">
    <path d="M211.648 89.515h-76.651A57.707 57.707 0 0077.291 147.2v242.389a57.707 57.707 0 0057.706 57.707h242.411a57.707 57.707 0 0057.707-57.707V288.128l34.624-23.744v125.227a92.35 92.35 0 01-92.331 92.33H134.997a92.349 92.349 0 01-92.33-92.33v-242.39A92.336 92.336 0 0169.702 81.92a92.33 92.33 0 0165.295-27.05h96.96l-20.309 34.645z"/>
    <path d="M380.16 0c3.093 0 5.717 2.219 6.379 5.248a149.328 149.328 0 0040.533 74.325 149.332 149.332 0 0074.347 40.555c3.029.661 5.248 3.285 5.248 6.4a6.574 6.574 0 01-5.248 6.357 149.338 149.338 0 00-74.326 40.555 149.338 149.338 0 00-40.789 75.413 6.334 6.334 0 01-6.144 5.078 6.334 6.334 0 01-6.144-5.078 149.338 149.338 0 00-40.789-75.413 149.326 149.326 0 00-75.414-40.789 6.338 6.338 0 01-5.077-6.144c0-2.987 2.133-5.547 5.077-6.144a149.336 149.336 0 0075.414-40.79 149.354 149.354 0 0040.554-74.325A6.573 6.573 0 01380.16 0z"/></g><defs><clipPath id="prefix__clip0_5_13"><path fill="#fff" d="M0 0h512v512H0z"/></clipPath></defs></svg>
);


const ColorModeSwitcher = () => {
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
    />
  );
};

const Header = ({ isTestMode, setIsTestMode }) => {
  const headerBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Box
      as="header"
      position="sticky" // ghim header
      top="0"
      zIndex="10" // Dam bao header luon o tren
      bg={headerBg}
      px={6}
      py={4} //  chieu cao
      borderBottomWidth="1px"
      borderColor={borderColor}
    >
      <Flex h={12} alignItems="center" justifyContent="space-between">
        <HStack spacing={4} alignItems="center">
          <Logo />
          <Heading as="h1" size="md" fontWeight="normal">
            AI Log Analyzer
          </Heading>
        </HStack>

        <Flex alignItems="center">
          <FormControl display="flex" alignItems="center" w="auto" mr={4}>
            <FormLabel htmlFor="test-mode-switch" mb="0" mr={2} whiteSpace="nowrap" fontSize="sm">
              <Text as="span" d={{ base: 'none', md: 'inline' }}>Test Mode</Text>
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
    </Box>
  );
};

export default Header;