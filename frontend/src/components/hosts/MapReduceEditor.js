import React from 'react';
import {
    Box, VStack, HStack, Text, IconButton, Button, 
    useColorModeValue, Select, SimpleGrid, Flex,
    Badge, Input, Divider
} from '@chakra-ui/react';
import { AddIcon, MinusIcon } from '@chakra-ui/icons';
import ApiKeySelector from './ApiKeySelector';

const MapReduceEditor = ({ substages, onAdd, onRemove, onUpdate, geminiModels, isTestMode }) => {
 
    const traceColor = useColorModeValue('gray.300', 'cyan.700');
    
    const nodeBg = useColorModeValue('white', 'gray.800'); 
    const nodeBorder = useColorModeValue('gray.200', 'gray.600');
    const hoverBorder = "blue.300";
    
    const selectBg = useColorModeValue('gray.50', 'gray.900');

    return (
        <Box position="relative" pl={6} py={2}>
            {/* // Day noi doc (Main Bus) */}
            <Box 
                position="absolute" 
                left="22px" 
                top="-10px" 
                bottom="20px" 
                width="2px" 
                bg={traceColor} 
                zIndex={0}
            />

            <VStack spacing={4} align="stretch" position="relative" zIndex={1}>
                {/* // Label Goc */}
                <Flex align="center" mb={2}>
                    <Box 
                        w="8px" h="8px" borderRadius="full" bg="cyan.500" 
                        position="absolute" left="19px" 
                        boxShadow="0 0 8px cyan"
                    />
                    <Text ml={10} fontSize="xs" fontWeight="normal" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                        Map-Reduce Workers
                    </Text>
                </Flex>

         
                {substages && substages.map((sub, idx) => (
                    <Box key={idx} position="relative" ml={10}>
                   
                        <Box 
                            position="absolute" 
                            left="-18px" 
                            top="20px" 
                            width="18px" 
                            height="2px" 
                            bg={traceColor} 
                            borderTopLeftRadius="md"
                            borderBottomLeftRadius="md"
                        />
                        

                        <Box 
                            bg={nodeBg} 
                            borderWidth="1px" 
                            borderColor={nodeBorder} 
                            borderRadius="md" 
                            p={3} 
                            position="relative"
                            _hover={{ borderColor: hoverBorder, boxShadow: "sm" }}
                            transition="all 0.2s"
                        >
                            <Flex justify="space-between" mb={3} align="center">
                                <HStack>
                                    <Badge 
                                        colorScheme="green"
                                        variant="subtle" 
                                        fontSize="0.8em"
                                        fontWeight="normal"
                                        px={2} 
                                        py={1}
                                        borderRadius="full"
                                    >
                                        Worker #{idx + 1}
                                    </Badge>
                                    


                                    <Input 
                                        size="sm" 
                                        value={sub.name} 
                                        onChange={e => onUpdate(idx, 'name', e.target.value)} 
                                        fontWeight="normal" 
                                        variant="unstyled" 
                                        placeholder="Worker Name"
                                        w="200px"
                                    />
                                </HStack>
                                
                                <IconButton 
                                    size="xs" 
                                    icon={<MinusIcon />} 
                                    variant="ghost" 
                                    color="gray.500"
                                    _hover={{ bg: 'red.100', color: 'red.500' }}
                                    onClick={() => onRemove(idx)} 
                                    aria-label="Remove"
                                />
                            </Flex>
                            
                            <Divider mb={3} />
                            
                            <SimpleGrid columns={{base: 1, md: 2}} spacing={3}>
                                <Box>
                                    <Text fontSize="xs" color="gray.500" mb={1}>Model</Text>
                                    <Select 
                                        size="xs" 
                                        value={sub.model} 
                                        onChange={e => onUpdate(idx, 'model', e.target.value)}
                                        bg={selectBg}
                                    >
                                        {Object.entries(geminiModels).map(([k,v])=> <option key={v} value={v}>{k}</option>)}
                                    </Select>
                                </Box>
                                <Box>
                                    <Text fontSize="xs" color="gray.500" mb={1}>API Key (Optional)</Text>
                                    <ApiKeySelector 
                                        value={sub.gemini_api_key}
                                        onChange={(val) => onUpdate(idx, 'gemini_api_key', val)}
                                        isTestMode={isTestMode}
                                    />
                                </Box>
                            </SimpleGrid>
                        </Box>
                    </Box>
                ))}


                <Box position="relative" ml={10}>
                     {/* // Day noi cong */}
                     <Box 
                        position="absolute" 
                        left="-18px" 
                        top="50%" 
                        width="18px" 
                        height="2px" 
                        bg={traceColor} 
                        opacity={0.5}
                    />
                    <Button 
                        size="sm" 
                        leftIcon={<AddIcon />} 
                        variant="outline" 
                        borderStyle="dashed"
                        w="full"
                        color="gray.500"
                        fontWeight="normal"
                        onClick={onAdd}
                        _hover={{ borderColor: hoverBorder, color: "blue.500", bg: 'transparent' }}
                    >
                        Add Parallel Worker
                    </Button>
                </Box>
            </VStack>
        </Box>
    );
};

export default MapReduceEditor;