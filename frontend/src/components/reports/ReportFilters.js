import React from 'react';
import { HStack, Input, Select, useColorModeValue } from '@chakra-ui/react';

const ReportFilters = ({ filters, onFilterChange }) => {

  const selectTextColor = useColorModeValue('gray.500', 'whiteAlpha.700');

  return (
    <HStack spacing={4} mb={6}>
      <Input
        placeholder="Filter by hostname..."
        value={filters.hostname}
        onChange={(e) => onFilterChange({ ...filters, hostname: e.target.value })}
        maxW="300px"
      />
      <Select
        placeholder="Filter by Type"
        value={filters.type}
        onChange={(e) => onFilterChange({ ...filters, type: e.target.value })}
        maxW="200px"
        // // tam fix: style cho placeholder ở dark mode để dễ nhìn hơn
        sx={{
            'option[value=""]': {
                color: selectTextColor
            }
        }}
      >
        <option value="periodic">Periodic</option>
        <option value="summary">Summary</option>
        <option value="final">Final</option>
      </Select>
    </HStack>
  );
};

export default ReportFilters;