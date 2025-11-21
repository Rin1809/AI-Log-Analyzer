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
import { useLanguage } from '../../context/LanguageContext';

const HostCard = ({ host, onToggleStatus, onEditConfig }) => {
  const cardBg = useColorModeValue('gray.50', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const { t } = useLanguage();

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
          <Heading size="md" isTruncated title={host.hostname}>{host.hostname}</Heading>
          <Badge colorScheme={host.is_enabled ? 'green' : 'red'} variant="solid" fontSize="0.7em">{host.status}</Badge>
        </HStack>
        <Text fontSize="xs" color="gray.500" minHeight="3em">
          {t('lastRun')}: {host.last_run !== 'Never' ? new Date(host.last_run).toLocaleString() : t('never')}
        </Text>
        <HStack justify="space-between" mt={2}>
          <FormControl display="flex" alignItems="center">
            <FormLabel htmlFor={`switch-${host.id}`} mb="0" fontSize="sm" mr={2}>{t('isEnabled')}</FormLabel>
            <Switch size="sm" id={`switch-${host.id}`} isChecked={host.is_enabled} onChange={() => onToggleStatus(host.id)} colorScheme="blue" />
          </FormControl>
          <Tooltip label={t('editConfig')} placement="top">
            <IconButton
              size="sm"
              variant="ghost"
              icon={<EditIcon />}
              onClick={() => onEditConfig(host.id)}
              aria-label="Edit configuration"
            />
          </Tooltip>
        </HStack>
      </VStack>
    </Box>
  );
};

export default HostCard;