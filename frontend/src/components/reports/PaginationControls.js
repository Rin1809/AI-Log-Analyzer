import React from 'react';
import { HStack, Text, IconButton } from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';

const PaginationControls = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    return (
        <HStack justify="flex-end" mt={4} spacing={2}>
            <Text fontSize="sm">Page {currentPage} of {totalPages}</Text>
            <IconButton
                icon={<ChevronLeftIcon />}
                size="sm"
                aria-label="Previous Page"
                onClick={() => onPageChange(prev => Math.max(prev - 1, 1))}
                isDisabled={currentPage === 1}
            />
            <IconButton
                icon={<ChevronRightIcon />}
                size="sm"
                aria-label="Next Page"
                onClick={() => onPageChange(prev => Math.min(prev + 1, totalPages))}
                isDisabled={currentPage === totalPages}
            />
        </HStack>
    );
};

export default PaginationControls;