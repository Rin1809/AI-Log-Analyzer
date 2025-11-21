import React from 'react';
import {
  Flex,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Button,
  Icon,
  useColorModeValue
} from '@chakra-ui/react';
import { SearchIcon, RepeatIcon } from '@chakra-ui/icons';
import { useLanguage } from '../../context/LanguageContext';

const ReportFilters = ({ filters, onFilterChange, uniqueTypes }) => {
  const inputBg = useColorModeValue('white', 'gray.700');
  const { t } = useLanguage();

  const handleReset = () => {
      onFilterChange({
          hostname: '',
          type: '',
          status: '',
          startDate: '',
          endDate: ''
      });
  };

  return (
      <Flex direction={{ base: 'column', lg: 'row' }} gap={4} align={{ base: 'stretch', lg: 'flex-end' }} mb={6}>
          {/* Hostname Search */}
          <FormControl flex="1">
              <FormLabel fontSize="sm" fontWeight="normal" color="gray.500">{t('hostname')}</FormLabel>
              <InputGroup>
                  <InputLeftElement pointerEvents="none"><SearchIcon color="gray.400" /></InputLeftElement>
                  <Input 
                      placeholder={t('search')}
                      value={filters.hostname}
                      onChange={(e) => onFilterChange(prev => ({ ...prev, hostname: e.target.value }))}
                      bg={inputBg}
                  />
              </InputGroup>
          </FormControl>

          {/* Type Filter */}
          <FormControl w={{ base: '100%', lg: '180px' }}>
              <FormLabel fontSize="sm" color="gray.500">{t('type')}</FormLabel>
              <Select 
                  value={filters.type} 
                  onChange={(e) => onFilterChange(prev => ({ ...prev, type: e.target.value }))} 
                  bg={inputBg}
              >
                  <option value="">{t('allTypes')}</option>
                  {uniqueTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                  ))}
              </Select>
          </FormControl>
          
          {/* Status Filter */}
          <FormControl w={{ base: '100%', lg: '150px' }}>
              <FormLabel fontSize="sm" color="gray.500">{t('status')}</FormLabel>
              <Select 
                  value={filters.status} 
                  onChange={(e) => onFilterChange(prev => ({ ...prev, status: e.target.value }))} 
                  bg={inputBg}
              >
                  <option value="">{t('allStatus')}</option>
                  <option value="success">{t('success')}</option>
                  <option value="error">{t('error')}</option>
              </Select>
          </FormControl>

          {/* Date Range */}
          <FormControl w={{ base: '100%', lg: '160px' }}>
               <FormLabel fontSize="sm" color="gray.500">{t('fromDate')}</FormLabel>
               <Input type="date" value={filters.startDate} onChange={(e) => onFilterChange(prev => ({ ...prev, startDate: e.target.value }))} bg={inputBg} />
          </FormControl>
          <FormControl w={{ base: '100%', lg: '160px' }}>
               <FormLabel fontSize="sm" color="gray.500">{t('toDate')}</FormLabel>
               <Input type="date" value={filters.endDate} onChange={(e) => onFilterChange(prev => ({ ...prev, endDate: e.target.value }))} bg={inputBg} />
          </FormControl>

          <Button leftIcon={<Icon as={RepeatIcon} />} onClick={handleReset} colorScheme="gray" variant="outline" fontWeight="normal">
              {t('reset')}
          </Button>
      </Flex>
  );
};

export default ReportFilters;