import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
    HStack,
    IconButton,
    useDisclosure,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    ModalCloseButton,
    Button,
    Textarea,
    Input,
    useToast,
    Tooltip,
    Text,
    Box,
    Menu,
    MenuButton,
    MenuList,
    MenuItem,
    MenuDivider,
    Tag,
    Wrap,
    WrapItem,
    useColorModeValue,
    Flex,
    Divider,
    Icon
} from '@chakra-ui/react';
import { 
    AddIcon, EditIcon, DeleteIcon, SettingsIcon, 
    ExternalLinkIcon, ChevronDownIcon 
} from '@chakra-ui/icons';

// Icon file text don gian
const FileIcon = (props) => (
    <Icon viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
    </Icon>
);

const PLACEHOLDERS = [
    { label: 'Log Content', value: '{logs_content}' },
    { label: 'Bonus Context', value: '{bonus_context}' },
    { label: 'Reports (Summary)', value: '{reports_content}' }
];

const PromptManager = ({ value, onChange, isTestMode }) => {
    const [prompts, setPrompts] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Modal State
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [editorMode, setEditorMode] = useState('view'); 
    const [editorFilename, setEditorFilename] = useState('');
    const [editorContent, setEditorContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const textareaRef = useRef(null);
    const toast = useToast();

    // Styles
    const borderColor = useColorModeValue('gray.200', 'gray.600');
    const hoverBorderColor = useColorModeValue('blue.400', 'blue.400');
    const bg = useColorModeValue('white', 'gray.700');
    const editorBg = 'gray.900'; 
    const editorColor = 'gray.100';

    // --- Load Prompts ---
    const fetchPrompts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/prompts', { params: { test_mode: isTestMode } });
            setPrompts(res.data);
        } catch (err) {
            console.error("Failed to load prompts", err);
        } finally {
            setLoading(false);
        }
    }, [isTestMode]);

    useEffect(() => {
        fetchPrompts();
    }, [fetchPrompts]);

    // --- Handlers ---

    const handleOpenEditor = async (mode) => {
        setEditorMode(mode);
        
        if (mode === 'create') {
            setEditorFilename('');
            setEditorContent('Bạn là chuyên gia an ninh mạng...\n\n--- DỮ LIỆU ---\n{logs_content}');
            onOpen();
        } else {
            if (!value) return;
            try {
                const res = await axios.get(`/api/prompts/${value}`, { params: { test_mode: isTestMode } });
                setEditorFilename(res.data.filename);
                setEditorContent(res.data.content);
                onOpen();
            } catch (err) {
                toast({ title: "Error loading content", description: err.message, status: "error" });
            }
        }
    };

    const handleSavePrompt = async () => {
        let finalName = editorFilename.trim();
        if (!finalName) {
            toast({ title: "Filename required", status: "warning" });
            return;
        }
        if (!finalName.endsWith('.md')) finalName += '.md';

        setIsSaving(true);
        try {
            await axios.post('/api/prompts', {
                filename: finalName,
                content: editorContent
            }, { params: { test_mode: isTestMode } });

            toast({ title: "Prompt Saved", status: "success" });
            await fetchPrompts();
            onChange(finalName); 
            onClose();
        } catch (err) {
            toast({ title: "Save Failed", description: err.response?.data?.detail || err.message, status: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeletePrompt = async () => {
        if (!value) return;
        if (!window.confirm(`Delete prompt "${value}" permanently?`)) return;

        try {
            await axios.delete(`/api/prompts/${value}`, { params: { test_mode: isTestMode } });
            toast({ title: "Deleted", status: "success" });
            await fetchPrompts();
            onChange('');
        } catch (err) {
            toast({ title: "Delete Failed", description: err.response?.data?.detail || err.message, status: "error" });
        }
    };

    const insertPlaceholder = (text) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const previousValue = textarea.value;
        const newValue = previousValue.substring(0, start) + text + previousValue.substring(end);
        setEditorContent(newValue);
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + text.length, start + text.length);
        }, 0);
    };

    return (
        <>
            {/* Unified Toolbar Container */}
            <Flex 
                align="center" 
                borderWidth="1px" 
                borderColor={borderColor} 
                borderRadius="md" 
                bg={bg}
                transition="all 0.2s"
                _hover={{ borderColor: hoverBorderColor, boxShadow: 'sm' }}
                h="32px" // Fixed height to match inputs
            >
                {/* Dropdown Section */}
                <Menu matchWidth>
                    <MenuButton 
                        as={Button} 
                        variant="ghost" 
                        rightIcon={<ChevronDownIcon color="gray.500" />} 
                        textAlign="left"
                        fontWeight="normal"
                        fontSize="sm"
                        flex="1"
                        h="100%"
                        borderRadius="0"
                        borderTopLeftRadius="md"
                        borderBottomLeftRadius="md"
                        overflow="hidden"
                        _focus={{ boxShadow: 'none' }}
                        _active={{ bg: 'transparent' }}
                    >
                        <HStack spacing={2}>
                            <FileIcon color={value ? "blue.500" : "gray.400"} boxSize={4} />
                            <Text isTruncated color={value ? "inherit" : "gray.500"}>
                                {value || "Select a prompt file..."}
                            </Text>
                        </HStack>
                    </MenuButton>
                    <MenuList zIndex={15} maxH="300px" overflowY="auto">
                        {prompts.length === 0 && <MenuItem isDisabled>No prompts found</MenuItem>}
                        {prompts.map(p => (
                            <MenuItem key={p} onClick={() => onChange(p)} icon={<FileIcon color="gray.400"/>}>
                                {p}
                            </MenuItem>
                        ))}
                        <MenuDivider />
                        <MenuItem icon={<AddIcon />} onClick={() => handleOpenEditor('create')} color="blue.500" fontWeight="medium">
                            Create New Template...
                        </MenuItem>
                    </MenuList>
                </Menu>

                <Divider orientation="vertical" h="20px" />

                {/* Actions Section */}
                <HStack spacing={0} px={1}>
                    <Tooltip label="Edit / View Content" hasArrow>
                        <IconButton 
                            icon={<EditIcon />} 
                            size="sm" 
                            variant="ghost" 
                            colorScheme="gray"
                            isDisabled={!value}
                            onClick={() => handleOpenEditor('edit')}
                            aria-label="Edit"
                            h="24px" w="24px" minW="24px"
                            borderRadius="md"
                        />
                    </Tooltip>
                    
                    <Menu>
                        <Tooltip label="Manage" hasArrow>
                            <MenuButton 
                                as={IconButton} 
                                icon={<SettingsIcon />} 
                                size="sm" 
                                variant="ghost" 
                                colorScheme="gray"
                                aria-label="Settings"
                                h="24px" w="24px" minW="24px"
                                borderRadius="md"
                            />
                        </Tooltip>
                        <MenuList zIndex={15}>
                            <MenuItem icon={<AddIcon />} onClick={() => handleOpenEditor('create')}>
                                Create New
                            </MenuItem>
                            <MenuItem icon={<DeleteIcon />} color="red.500" isDisabled={!value} onClick={handleDeletePrompt}>
                                Delete Current
                            </MenuItem>
                        </MenuList>
                    </Menu>
                </HStack>
            </Flex>

            {/* Advanced Editor Modal */}
            <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside" closeOnOverlayClick={false}>
                <ModalOverlay backdropFilter="blur(4px)" />
                <ModalContent h="85vh" display="flex" flexDirection="column" bg={editorBg} color={editorColor}>
                    <ModalHeader borderBottom="1px solid" borderColor="gray.700" py={3} bg="gray.800" borderTopRadius="md">
                        <HStack justify="space-between">
                            <HStack>
                                <Icon as={EditIcon} color="blue.400" />
                                <Text fontSize="md" fontFamily="monospace">
                                    {editorMode === 'create' ? 'New Prompt' : editorFilename}
                                </Text>
                                {editorMode === 'edit' && <Tag size="sm" colorScheme="gray" variant="solid">EDITING</Tag>}
                            </HStack>
                            
                            {editorMode === 'create' && (
                                <Input 
                                    size="sm" 
                                    w="350px" 
                                    placeholder="filename.md" 
                                    value={editorFilename}
                                    onChange={(e) => setEditorFilename(e.target.value)}
                                    autoFocus
                                    bg="gray.700"
                                    border="none"
                                    color="white"
                                    _placeholder={{ color: 'gray.500' }}
                                />
                            )}
                        </HStack>
                    </ModalHeader>
                    
                    <ModalCloseButton color="white" />
                    
                    <ModalBody p={0} display="flex" flexDirection="column" flex={1}>
                        {/* Toolbar */}
                        <Box py={2} px={4} bg="gray.800" borderBottom="1px solid" borderColor="gray.700">
                            <HStack spacing={4}>
                                <Text fontSize="xs" color="gray.500" fontWeight="bold" letterSpacing="wide">VARIABLES:</Text>
                                <Wrap spacing={2}>
                                    {PLACEHOLDERS.map(ph => (
                                        <WrapItem key={ph.value}>
                                            <Tag 
                                                size="sm" 
                                                variant="solid" 
                                                bg="gray.700" 
                                                color="teal.300"
                                                cursor="pointer" 
                                                _hover={{ bg: "teal.900", color: "teal.200" }}
                                                onClick={() => insertPlaceholder(ph.value)}
                                                fontFamily="monospace"
                                            >
                                                {ph.label}
                                            </Tag>
                                        </WrapItem>
                                    ))}
                                </Wrap>
                            </HStack>
                        </Box>

                        {/* Editor Area */}
                        <Box flex={1} position="relative">
                            <Textarea 
                                ref={textareaRef}
                                value={editorContent}
                                onChange={(e) => setEditorContent(e.target.value)}
                                fontFamily="'Consolas', 'Monaco', 'Courier New', monospace"
                                fontSize="14px"
                                lineHeight="1.6"
                                h="100%"
                                w="100%"
                                bg="transparent"
                                color="gray.300"
                                border="none"
                                p={4}
                                resize="none"
                                _focus={{ boxShadow: 'none' }}
                                spellCheck={false}
                                sx={{
                                    '&::-webkit-scrollbar': { width: '8px' },
                                    '&::-webkit-scrollbar-track': { bg: 'gray.900' },
                                    '&::-webkit-scrollbar-thumb': { bg: 'gray.700', borderRadius: '4px' },
                                }}
                            />
                        </Box>
                    </ModalBody>

                    <ModalFooter borderTop="1px solid" borderColor="gray.700" bg="gray.800" py={3} borderBottomRadius="md">
                        <Text fontSize="xs" color="gray.500" mr="auto" fontFamily="monospace">
                            Mode: Markdown • Line: {editorContent.split('\n').length}
                        </Text>
                        <Button variant="ghost" mr={3} onClick={onClose} size="sm" color="gray.400" _hover={{ color: "white", bg: "gray.700" }}>
                            Cancel
                        </Button>
                        <Button colorScheme="gray" onClick={handleSavePrompt} isLoading={isSaving} leftIcon={<ExternalLinkIcon />} size="sm">
                            Save Prompt
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
};

export default PromptManager;