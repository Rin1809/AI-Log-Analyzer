import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Flex, useColorModeValue } from '@chakra-ui/react';
import Sidebar from './common/Sidebar';
import Header from './common/Header';

const Layout = () => {
  const bg = useColorModeValue('gray.50', 'gray.900');
  const [isTestMode, setIsTestMode] = useState(false);

  return (
    <Flex minH="100vh" bg={bg}>
      <Sidebar />
      <Box ml="80px" w="full"> 
        
        
        <Header isTestMode={isTestMode} setIsTestMode={setIsTestMode} />
        
    
        <Box as="main" p={{ base: 4, md: 6 }}>
          <Outlet context={{ isTestMode }} />
        </Box>
        
      </Box>
    </Flex>
  );
};

export default Layout;