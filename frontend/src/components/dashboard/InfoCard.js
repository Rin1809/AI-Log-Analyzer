import React from 'react';
import { Box, useColorModeValue } from '@chakra-ui/react';

const InfoCard = ({ children }) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Box
      p={5}
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="lg"
      bg={cardBg}
      h="350px"
      transition="all 0.2s"
    >
      {children}
    </Box>
  );
};

export default InfoCard;