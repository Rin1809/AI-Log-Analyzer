import React from 'react';
import { HStack, Input, Select, useColorModeValue } from '@chakra-ui/react';

const ReportFilters = ({ filters, onFilterChange }) => {
    const inputBg = useColorModeValue('gray.50', 'gray.700');
    
    const handleInputChange = (e) => {
        onFilterChange({ ...filters, hostname: e.target.value });
    };
    
    const handleSelectChange = (e) => {
        onFilterChange({ ...filters, type: e.target.value });
    };

    return (
        <HStack mb={4} spacing={4}>
            <Input
                placeholder="Filter by Hostname"
                value={filters.hostname}
                onChange={handleInputChange}
                bg={inputBg}
            />
            <Select
                placeholder="Filter by Type"
                value={filters.type}
                onChange={handleSelectChange}
                bg={inputBg}
            >
                <option value="">All Types</option>
                <option value="periodic">Periodic</option>
                <option value="summary">Summary</option>
                <option value="final">Final</option>
            </Select>
        </HStack>
    );
};

export default ReportFilters;