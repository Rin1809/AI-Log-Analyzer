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
    <svg xmlns="http://www.w3.org/2000/svg" width="32px" height="32px" viewBox="0 0 256 256">
        <path fill="#000000ff" d="M128 24a104 104 0 1 0 104 104A104.12 104.12 0 0 0 128 24Zm-21.23 74.77a8 8 0 0 1 11.31 0L128 108.69l9.9-9.9a8 8 0 0 1 11.31 11.31L139.31 120l9.9 9.9a8 8 0 0 1-11.31 11.31L128 131.31l-9.9 9.9a8 8 0 0 1-11.31-11.31L116.69 120l-9.9-9.9a8 8 0 0 1 0-11.32Z"/>
        <path fill="#000000ff" d="m181.23 109.23l-11.32-11.31a8 8 0 0 0-11.31 11.31L168.5 120l-9.9 9.9a8 8 0 0 0 11.31 11.31l11.32-11.32a8 8 0 0 0 0-11.32ZM74.77 109.23a8 8 0 0 0-11.31 0l-11.32 11.32a8 8 0 0 0 0 11.32l11.32 11.31a8 8 0 0 0 11.31-11.31L64.89 120l9.88-9.9a8 8 0 0 0 0-11.32Z"/>
    </svg>
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
      py={4} // chieu cao
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