import React from 'react';
import {
  Box,
  Flex,
  Heading,
  FormControl,
  FormLabel,
  Switch,
  Text,
  useColorModeValue,
  IconButton,
  useColorMode,
} from '@chakra-ui/react';
import { SunIcon, MoonIcon } from '@chakra-ui/icons';

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
      bg={headerBg}
      p={4}
      borderRadius="lg"
      borderWidth="1px"
      borderColor={borderColor}
      boxShadow="sm"
      mb={6}
    >
      <Flex justify="space-between" align="center">
        <Box>
          <Heading as="h1" size="lg" fontWeight="bold">
            AI Log Analyzer
          </Heading>
          <Text fontSize="sm" color={useColorModeValue('gray.500', 'gray.400')}>
            Dashboard Overview
          </Text>
        </Box>

        <Flex align="center">
          <FormControl display="flex" alignItems="center" w="auto" mr={4}>
            <FormLabel htmlFor="test-mode-switch" mb="0" mr={3} whiteSpace="nowrap">
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
    </Box>
  );
};

export default Header;