import React from 'react';
import {
  Box,
  Input,
  Select,
  InputGroup,
  InputLeftElement,
  Button,
  Collapse,
  useDisclosure,
  SimpleGrid,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  useColorModeValue,
  Tooltip
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';

// Icon Filter custom
const FilterListIcon = (props) => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
  </svg>
);

const ReportFilters = ({ filters, onFilterChange, uniqueTypes = [] }) => {
  const { isOpen, onToggle } = useDisclosure();
  const bg = useColorModeValue('gray.50', 'gray.700');

  const handleChange = (field, value) => {
    onFilterChange(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    onFilterChange({
      hostname: '',
      type: '',
      status: '',
      startDate: '',
      endDate: ''
    });
  };

  // Tinh so luong filter dang active (tru hostname vi no hien san o ngoai)
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const hasAdvancedFilters = activeFilterCount > (filters.hostname ? 1 : 0);

  return (
    <Box mb={6}>
      <HStack spacing={2} mb={isOpen ? 4 : 0}>
        {/* Quick Search Hostname */}
        <InputGroup maxW="400px">
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.300" />
          </InputLeftElement>
          <Input 
            placeholder="Search hostname..." 
            value={filters.hostname}
            onChange={(e) => handleChange('hostname', e.target.value)}
            bg={useColorModeValue('white', 'gray.800')}
            borderRadius="md"
          />
        </InputGroup>

        {/* Filter Toggle Button - Ghost Style */}
        <Tooltip label="Advanced Filters" hasArrow>
            <IconButton 
                icon={<FilterListIcon />} 
                onClick={onToggle} 
                variant="ghost" // Nằm dưới nền
                colorScheme={isOpen || hasAdvancedFilters ? "blue" : "gray"}
                aria-label="Toggle Filters"
                fontSize="20px"
            />
        </Tooltip>
        
        {/* Clear Button - Chi hien khi co filter */}
        {activeFilterCount > 0 && (
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters} 
                color="red.400" 
                fontWeight="normal"
                _hover={{ bg: 'red.50', color: 'red.500' }}
            >
                Clear
            </Button>
        )}
      </HStack>

      <Collapse in={isOpen} animateOpacity>
        <Box 
            p={4} 
            mt={4} 
            bg={bg} 
            rounded="md" 
            borderWidth="1px" 
            borderColor={useColorModeValue('gray.200', 'gray.600')}
            boxShadow="sm"
        >
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
            
            {/* Type Filter (Dynamic) */}
            <FormControl>
              <FormLabel fontSize="xs" color="gray.500" fontWeight="bold">REPORT TYPE</FormLabel>
              <Select 
                placeholder="All Types" 
                value={filters.type} 
                onChange={(e) => handleChange('type', e.target.value)}
                bg={useColorModeValue('white', 'gray.800')}
                size="sm"
                borderRadius="md"
              >
                {uniqueTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </Select>
            </FormControl>

            {/* Status Filter */}
            <FormControl>
              <FormLabel fontSize="xs" color="gray.500" fontWeight="bold">STATUS</FormLabel>
              <Select 
                placeholder="All Status" 
                value={filters.status} 
                onChange={(e) => handleChange('status', e.target.value)}
                bg={useColorModeValue('white', 'gray.800')}
                size="sm"
                borderRadius="md"
              >
                <option value="success">Success</option>
                <option value="error">Error / Quota</option>
              </Select>
            </FormControl>

            {/* Date Range */}
            <FormControl>
                <FormLabel fontSize="xs" color="gray.500" fontWeight="bold">FROM DATE</FormLabel>
                <Input 
                    type="date" 
                    value={filters.startDate} 
                    onChange={(e) => handleChange('startDate', e.target.value)}
                    bg={useColorModeValue('white', 'gray.800')}
                    size="sm"
                    borderRadius="md"
                />
            </FormControl>

            <FormControl>
                <FormLabel fontSize="xs" color="gray.500" fontWeight="bold">TO DATE</FormLabel>
                <Input 
                    type="date" 
                    value={filters.endDate} 
                    onChange={(e) => handleChange('endDate', e.target.value)}
                    bg={useColorModeValue('white', 'gray.800')}
                    size="sm"
                    borderRadius="md"
                />
            </FormControl>

          </SimpleGrid>
        </Box>
      </Collapse>
    </Box>
  );
};

export default ReportFilters;