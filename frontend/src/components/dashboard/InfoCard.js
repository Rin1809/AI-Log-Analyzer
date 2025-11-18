import React from 'react';
import { Box, Heading, useColorModeValue } from '@chakra-ui/react';

const InfoCard = ({ title, children }) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Box
      p={5}
      shadow="md"
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="lg"
      bg={cardBg}
      h="350px"
      transition="all 0.2s"
      _hover={{ shadow: 'lg' }}
    >
      <Heading size="sm" mb={4} textAlign="center" fontWeight="semibold">
        {title}
      </Heading>
      {children}
    </Box>
  );
};

export default InfoCard;