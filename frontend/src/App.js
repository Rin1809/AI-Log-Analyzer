import React from 'react';
import { ChakraProvider, Box, Heading, Container } from '@chakra-ui/react';
import Dashboard from './Dashboard';

function App() {
  return (
    <ChakraProvider>
      <Box bg="gray.50" minH="100vh">
        <Box bg="white" boxShadow="sm" py={4}>
          <Container maxW="container.xl">
            <Heading as="h1" size="lg" color="gray.700">
              Pfsense Log Analyzer Dashboard
            </Heading>
          </Container>
        </Box>
        <Container maxW="container.xl" pt={8} pb={8}>
          <Dashboard />
        </Container>
      </Box>
    </ChakraProvider>
  );
}

export default App;