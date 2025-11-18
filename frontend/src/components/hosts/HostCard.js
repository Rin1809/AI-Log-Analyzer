import React from 'react';
import {
  Box,
  Heading,
  VStack,
  HStack,
  Text,
  Switch,
  FormControl,
  FormLabel,
  useColorModeValue,
  Badge,
  IconButton,
  Tooltip,
} from '@chakra-ui/react';
import { EditIcon } from '@chakra-ui/icons';

const HostCard = ({ fw, onToggleStatus, onEditConfig }) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Box
      p={5}
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="lg"
      bg={cardBg}
      transition="all 0.2s"
      _hover={{ transform: 'translateY(-2px)' }}
    >
      <VStack align="stretch" spacing={4}>
        <HStack justify="space-between">
          <Heading size="md" isTruncated title={fw.hostname}>{fw.hostname}</Heading>
          <Badge colorScheme={fw.is_enabled ? 'green' : 'red'} variant="solid" fontSize="0.7em">{fw.status}</Badge>
        </HStack>
        <Text fontSize="xs" color="gray.500" minHeight="3em">
          Last run: {fw.last_run !== 'Never' ? new Date(fw.last_run).toLocaleString() : 'Never'}
        </Text>
        <HStack justify="space-between" mt={2}>
          <FormControl display="flex" alignItems="center">
            <FormLabel htmlFor={`switch-${fw.id}`} mb="0" fontSize="sm" mr={2}>Enabled</FormLabel>
            <Switch size="sm" id={`switch-${fw.id}`} isChecked={fw.is_enabled} onChange={() => onToggleStatus(fw.id)} colorScheme="blue" />
          </FormControl>
          <Tooltip label="Edit Config" placement="top">
            <IconButton
              size="sm"
              variant="ghost"
              icon={<EditIcon />}
              onClick={() => onEditConfig(fw.id)}
              aria-label="Edit configuration"
            />
          </Tooltip>
        </HStack>
      </VStack>
    </Box>
  );
};

export default HostCard;