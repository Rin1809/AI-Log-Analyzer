import React from 'react';
import {
  Box,
  Heading,
  Button,
  VStack,
  HStack,
  Text,
  Switch,
  FormControl,
  FormLabel,
  useColorModeValue,
  Badge,
} from '@chakra-ui/react';

const HostCard = ({ fw, onToggleStatus, onEditConfig }) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Box
      p={5}
      shadow="md"
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="md"
      bg={cardBg}
    >
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between">
          <Heading size="md" isTruncated title={fw.hostname}>{fw.hostname}</Heading>
          <Badge colorScheme={fw.is_enabled ? 'green' : 'red'}>{fw.status}</Badge>
        </HStack>
        <Text fontSize="sm" color="gray.500">
          Last run: {fw.last_run !== 'Never' ? new Date(fw.last_run).toLocaleString() : 'Never'}
        </Text>
        <HStack justify="space-between">
          <FormControl display="flex" alignItems="center">
            <FormLabel htmlFor={`switch-${fw.id}`} mb="0" fontSize="sm">Enabled</FormLabel>
            <Switch size="sm" id={`switch-${fw.id}`} isChecked={fw.is_enabled} onChange={() => onToggleStatus(fw.id)} />
          </FormControl>
          <Button size="sm" onClick={() => onEditConfig(fw.id)}>Edit Config</Button>
        </HStack>
      </VStack>
    </Box>
  );
};

export default HostCard;