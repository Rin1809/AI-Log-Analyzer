import React, { useState } from 'react';
import {
    Box, VStack, HStack, Text, IconButton,
    useColorModeValue, Select, SimpleGrid, Flex,
    Badge, Input, Divider, Collapse, Icon, FormControl, FormLabel,
    Tooltip
} from '@chakra-ui/react';
import { AddIcon, MinusIcon, ChevronDownIcon, ChevronRightIcon } from '@chakra-ui/icons';
import ApiKeySelector from './ApiKeySelector';
import PromptManager from './PromptManager';

const MapReduceEditor = ({ 
    substages, 
    summaryConf, 
    onAdd, 
    onRemove, 
    onUpdate, 
    onUpdateSummary, 
    geminiModels, 
    isTestMode 
}) => {
    // State cho viec Expand/Collapse
    const [isExpanded, setIsExpanded] = useState(true);
 
    const traceColor = useColorModeValue('gray.300', 'cyan.700');
    const nodeBg = useColorModeValue('white', 'gray.800'); 
    const nodeBorder = useColorModeValue('gray.200', 'gray.600');
    const hoverBorder = "blue.300";
    const selectBg = useColorModeValue('gray.50', 'gray.900');
    
    return (
        <Box position="relative" pl={6} py={2}>
            {/* Day noi doc (Main Bus) */}
            {isExpanded && (
                <Box 
                    position="absolute" 
                    left="22px" 
                    top="-10px" 
                    bottom="20px" 
                    width="2px" 
                    bg={traceColor} 
                    zIndex={0}
                />
            )}

            <VStack spacing={4} align="stretch" position="relative" zIndex={1}>
                {/* HEADER SECTION */}
                <Flex 
                    align="center" 
                    mb={2} 
                    justify="space-between" // Day nut Add sang phai
                    userSelect="none"
                >
                    {/* Left Side: Click to Toggle Expand */}
                    <Flex 
                        align="center" 
                        cursor="pointer" 
                        onClick={() => setIsExpanded(!isExpanded)}
                        _hover={{ opacity: 0.8 }}
                        flex="1"
                    >
                        <Box 
                            w="8px" h="8px" borderRadius="full" bg="cyan.500" 
                            position="absolute" left="19px" 
                            boxShadow="0 0 8px cyan"
                        />
                        <HStack ml={10} spacing={2}>
                            <Text fontSize="xs" fontWeight="normal" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                                Map-Reduce Workers ({substages?.length || 0})
                            </Text>
                            <Icon as={isExpanded ? ChevronDownIcon : ChevronRightIcon} color="gray.500" />
                        </HStack>
                    </Flex>

                    {/* Right Side: Add Button */}
                    <Tooltip label="Add Parallel Worker" hasArrow>
                        <IconButton 
                            icon={<AddIcon />} 
                            size="xs" 
                            variant="outline" 
                            colorScheme="gray"
                            borderRadius="full"
                            onClick={(e) => {
                                e.stopPropagation(); // Ngan khong cho toggle Collapse khi click nut Add
                                onAdd();
                                if (!isExpanded) setIsExpanded(true); // Tu dong mo ra neu dang dong
                            }}
                            aria-label="Add Worker"
                        />
                    </Tooltip>
                </Flex>

                {/* Noi dung Collapse */}
                <Collapse in={isExpanded} animateOpacity>
                    <VStack spacing={4} align="stretch">
                        
                        {/* LIST WORKERS */}
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
                                    <Flex 
                                        direction={{ base: 'column', sm: 'row' }} 
                                        justify="space-between" 
                                        mb={3} 
                                        align={{ base: 'stretch', sm: 'center' }}
                                        gap={2}
                                    >
                                        <HStack flex={1} spacing={2} w="full">
                                            <Badge colorScheme="green" variant="subtle" fontSize="0.8em" fontWeight="normal" px={2} py={1} borderRadius="full" flexShrink={0}>
                                                Worker #{idx + 1}
                                            </Badge>
                                            <Input 
                                                size="sm" 
                                                value={sub.name} 
                                                onChange={e => onUpdate(idx, 'name', e.target.value)} 
                                                fontWeight="normal" 
                                                variant="unstyled" 
                                                placeholder="Worker Name"
                                                flex={1}
                                                minW={0}
                                            />
                                        </HStack>
                                        <IconButton 
                                            size="xs" icon={<MinusIcon />} variant="ghost" color="gray.500"
                                            _hover={{ bg: 'red.100', color: 'red.500' }}
                                            onClick={() => onRemove(idx)} aria-label="Remove"
                                            alignSelf={{ base: 'flex-end', sm: 'auto' }}
                                        />
                                    </Flex>
                                    <Divider mb={3} />
                                    <SimpleGrid columns={{base: 1, xl: 2}} spacing={3}>
                                        <Box>
                                            <Text fontSize="xs" color="gray.500" mb={1}>Model</Text>
                                            <Select 
                                                size="xs" value={sub.model} 
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
                        
                        {/* REDUCE CONFIG SECTION */}
                        <Box position="relative" ml={10} mt={2}>
                            <Box position="absolute" left="-18px" top="20px" width="18px" height="2px" bg={traceColor} />
                            
                            <Box 
                                bg={nodeBg} 
                                borderWidth="1px" 
                                borderColor={nodeBorder} 
                                borderRadius="md" 
                                p={3}
                                _hover={{ borderColor: hoverBorder, boxShadow: "sm" }}
                                transition="all 0.2s"
                            >
                                <Flex align="center" mb={3}>
                                    <Badge colorScheme="orange" variant="subtle" fontSize="0.8em" fontWeight="normal" px={2} py={1} borderRadius="full" mr={2}>
                                        REDUCE
                                    </Badge>
                                    <Text fontSize="sm" fontWeight="normal" color="gray.600" _dark={{color: "gray.300"}}>
                                        Aggregation Configuration
                                    </Text>
                                </Flex>
                                
                                <Divider mb={3} />
                                
                                <SimpleGrid columns={{base: 1, xl: 2}} spacing={3}>
                                    <FormControl>
                                        <FormLabel fontSize="xs" mb={0} color="gray.500">Aggregation Model</FormLabel>
                                        <Select 
                                            size="xs" 
                                            value={summaryConf?.model || ''} 
                                            onChange={e => onUpdateSummary('model', e.target.value)}
                                            bg={selectBg}
                                            placeholder="Use Default Stage Model"
                                        >
                                            {Object.entries(geminiModels).map(([k,v])=> <option key={v} value={v}>{k}</option>)}
                                        </Select>
                                    </FormControl>

                                    <FormControl>
                                        <FormLabel fontSize="xs" mb={0} color="gray.500">Prompt File</FormLabel>
                                        <PromptManager 
                                            value={summaryConf?.prompt_file || 'summary_prompt_template.md'} 
                                            onChange={(newVal) => onUpdateSummary('prompt_file', newVal)}
                                            isTestMode={isTestMode}
                                        />
                                    </FormControl>
                                    
                                    <FormControl gridColumn={{xl: "span 2"}}>
                                        <FormLabel fontSize="xs" mb={0} color="gray.500">API Key (Optional)</FormLabel>
                                        <ApiKeySelector 
                                            value={summaryConf?.gemini_api_key || ''}
                                            onChange={(val) => onUpdateSummary('gemini_api_key', val)}
                                            isTestMode={isTestMode}
                                        />
                                    </FormControl>
                                </SimpleGrid>
                            </Box>
                        </Box>

                    </VStack>
                </Collapse>
            </VStack>
        </Box>
    );
};

export default MapReduceEditor;