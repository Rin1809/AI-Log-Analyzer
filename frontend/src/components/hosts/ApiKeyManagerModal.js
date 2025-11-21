import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
    Button, VStack, HStack, Box, Text, Input, IconButton,
    useToast, useColorModeValue, Divider, FormControl, FormLabel,
    InputGroup, InputRightElement, Spinner, Center, Checkbox, Flex, StackDivider
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon, CheckIcon, ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import { useLanguage } from '../../context/LanguageContext';

const ApiKeyManagerModal = ({ isOpen, onClose, isTestMode, onProfilesChange }) => {
    const [settings, setSettings] = useState(null);
    const [profiles, setProfiles] = useState({});
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { t } = useLanguage();
    
    // Selection State for Bulk Delete
    const [selectedItems, setSelectedItems] = useState(new Set());

    // Edit/Add State
    const [editingKey, setEditingKey] = useState(null); 
    const [formName, setFormName] = useState('');
    const [formKey, setFormKey] = useState('');
    const [showKey, setShowKey] = useState(false);

    const toast = useToast();
    
    const borderColor = useColorModeValue('gray.200', 'gray.600');
    const listBg = useColorModeValue('white', 'gray.800');
    const itemHoverBg = useColorModeValue('gray.50', 'gray.700');
    const activeBg = useColorModeValue('blue.50', 'blue.900');
    const deleteBarBg = useColorModeValue('gray.100', 'gray.900');
    const headerBg = useColorModeValue('white', 'gray.800');
    const formColBg = useColorModeValue('white', 'gray.900');
    const inputBg = useColorModeValue('gray.50', 'gray.800');

    const fetchSettings = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/system-settings', { params: { test_mode: isTestMode } });
            setSettings(res.data);
            setProfiles(res.data.gemini_profiles || {});
        } catch (err) {
            toast({ title: t('loadFailed'), description: err.message, status: "error" });
        } finally {
            setLoading(false);
        }
    }, [isTestMode, toast, t]);

    useEffect(() => {
        if (isOpen) {
            fetchSettings();
            resetForm();
            setSelectedItems(new Set());
        }
    }, [isOpen, fetchSettings]);

    const resetForm = () => {
        setEditingKey(null);
        setFormName('');
        setFormKey('');
        setShowKey(false);
    };

    const handleEditClick = (name, key) => {
        setEditingKey(name);
        setFormName(name);
        setFormKey(key); 
    };

    const toggleSelection = (name) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(name)) {
            newSet.delete(name);
        } else {
            newSet.add(name);
        }
        setSelectedItems(newSet);
    };

    const handleBulkDelete = async () => {
        if (selectedItems.size === 0) return;
        if(!window.confirm(`${t('deleteFilesConfirm')} (${selectedItems.size})`)) return;

        const newProfiles = { ...profiles };
        selectedItems.forEach(name => {
            delete newProfiles[name];
        });

        await saveProfiles(newProfiles);
        setSelectedItems(new Set());
        
        if (editingKey && selectedItems.has(editingKey)) {
            resetForm();
        }
    };

    const handleSaveClick = async () => {
        if (!formName.trim() || !formKey.trim()) {
            toast({ title: t('missingInfo'), status: "warning" });
            return;
        }

        const newProfiles = { ...profiles };
        if (editingKey && editingKey !== formName) {
            delete newProfiles[editingKey];
        }
        
        newProfiles[formName.trim()] = formKey.trim();
        
        await saveProfiles(newProfiles);
        resetForm();
    };

    const saveProfiles = async (updatedProfiles) => {
        setIsSaving(true);
        try {
            const payload = {
                ...settings,
                gemini_profiles: updatedProfiles
            };
            
            await axios.post('/api/system-settings', payload, { params: { test_mode: isTestMode } });
            
            setProfiles(updatedProfiles);
            if (onProfilesChange) onProfilesChange(updatedProfiles);
            
            toast({ title: t('success'), status: "success", duration: 2000 });
        } catch (err) {
            toast({ title: t('saveError'), description: err.message, status: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const profileKeys = Object.keys(profiles);

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="3xl" isCentered>
            <ModalOverlay backdropFilter="blur(2px)" />
            <ModalContent height="600px" display="flex" flexDirection="column" overflow="hidden">
                <ModalHeader fontWeight="normal" borderBottomWidth="1px" fontSize="lg" pb={3} bg={headerBg}>
                    {t('geminiKeyProfiles')}
                </ModalHeader>
                <ModalCloseButton />
                
                <ModalBody p={0} display="flex" flex="1" overflow="hidden">
                    {loading ? (
                        <Center w="full" h="full"><Spinner /></Center>
                    ) : (
                        <HStack spacing={0} w="full" h="full" alignItems="stretch">
                            <Box w="40%" borderRightWidth="1px" borderColor={borderColor} bg={listBg} display="flex" flexDirection="column">
                                {/* Header Action */}
                                <Box p={3} borderBottomWidth="1px" borderColor={borderColor}>
                                    <Button 
                                        w="full" size="sm" leftIcon={<AddIcon />} colorScheme="gray" variant="outline" fontWeight="normal"
                                        onClick={resetForm}
                                        isActive={!editingKey}
                                    >
                                        {t('addProfile')}
                                    </Button>
                                </Box>

                                {/* Scrollable List */}
                                <Box flex="1" overflowY="auto">
                                    {profileKeys.length === 0 ? (
                                        <Center h="100px" flexDirection="column">
                                            <Text fontSize="sm" color="gray.500">{t('noFilesFound')}</Text>
                                        </Center>
                                    ) : (
                                        <VStack spacing={0} align="stretch" divider={<StackDivider borderColor={borderColor} />}>
                                            {profileKeys.map((name) => (
                                                <HStack 
                                                    key={name} 
                                                    px={4} py={3}
                                                    cursor="pointer"
                                                    bg={editingKey === name ? activeBg : 'transparent'}
                                                    _hover={{ bg: itemHoverBg }}
                                                    transition="background 0.2s"
                                                    spacing={3}
                                                >
                                                    <Checkbox 
                                                        isChecked={selectedItems.has(name)}
                                                        onChange={(e) => {
                                                            e.stopPropagation();
                                                            toggleSelection(name);
                                                        }}
                                                        colorScheme="gray"
                                                        borderColor="gray.400"
                                                    />
                                                    
                                                    <VStack 
                                                        align="start" 
                                                        spacing={0} 
                                                        flex="1" 
                                                        overflow="hidden"
                                                        onClick={() => handleEditClick(name, profiles[name])}
                                                    >
                                                        <Text fontWeight="medium" fontSize="sm" isTruncated w="full" color="gray.700" _dark={{color: "gray.200"}}>
                                                            {name}
                                                        </Text>
                                                        <Text fontSize="xs" fontFamily="monospace" color="gray.500">
                                                            {profiles[name].length > 8 ? `...${profiles[name].slice(-6)}` : '****'}
                                                        </Text>
                                                    </VStack>
                                                </HStack>
                                            ))}
                                        </VStack>
                                    )}
                                </Box>

                                {/* BULK DELETE BAR */}
                                {selectedItems.size > 0 && (
                                    <Flex 
                                        p={3} 
                                        bg={deleteBarBg} 
                                        borderTopWidth="1px" 
                                        borderColor={borderColor}
                                        align="center"
                                        justify="space-between"
                                        animation="fadeIn 0.2s"
                                    >
                                        <Text fontSize="xs" color="gray.600" fontWeight="medium">
                                            {selectedItems.size} selected
                                        </Text>
                                        <Button 
                                            size="sm" 
                                            colorScheme="gray" 
                                            variant="ghost" 
                                            leftIcon={<DeleteIcon />}
                                            onClick={handleBulkDelete}
                                            fontSize="xs"
                                        >
                                            {t('delete')}
                                        </Button>
                                    </Flex>
                                )}
                            </Box>

                            {/* RIGHT COLUMN: FORM */}
                            <Box w="60%" p={6} overflowY="auto" bg={formColBg}>
                                <VStack spacing={5} align="stretch">
                                    <Box>
                                        <Text fontWeight="bold" fontSize="lg" mb={1}>
                                            {editingKey ? t('edit') : t('addProfile')}
                                        </Text>
                                        <Text fontSize="sm" color="gray.500">
                                            {t('manageKeys')}
                                        </Text>
                                    </Box>
                                    
                                    <Divider />

                                    <FormControl isRequired>
                                        <FormLabel fontSize="sm" fontWeight="medium">{t('profileName')}</FormLabel>
                                        <Input 
                                            placeholder="e.g. Production_Key_1" 
                                            value={formName} 
                                            onChange={e => setFormName(e.target.value)}
                                            bg={inputBg}
                                        />
                                    </FormControl>

                                    <FormControl isRequired>
                                        <FormLabel fontSize="sm" fontWeight="medium">{t('apiKey')}</FormLabel>
                                        <InputGroup>
                                            <Input 
                                                type={showKey ? "text" : "password"} 
                                                placeholder="AIzaSy..." 
                                                value={formKey} 
                                                onChange={e => setFormKey(e.target.value)}
                                                fontFamily="monospace"
                                                bg={inputBg}
                                            />
                                            <InputRightElement>
                                                <IconButton 
                                                    size="sm" variant="ghost" 
                                                    icon={showKey ? <ViewOffIcon/> : <ViewIcon/>}
                                                    onClick={() => setShowKey(!showKey)}
                                                />
                                            </InputRightElement>
                                        </InputGroup>
                                        <Text fontSize="xs" color="gray.400" mt={2}>
                                            {t('encryptNote')}
                                        </Text>
                                    </FormControl>

                                    <Flex justify="flex-end" pt={6} gap={3}>
                                        {editingKey && (
                                            <Button size="sm" fontWeight="normal" variant="ghost" onClick={resetForm}>{t('cancel')}</Button>
                                        )}
                                        <Button 
                                            size="sm" fontWeight="normal" colorScheme="gray" bg="gray.800" color="white" _hover={{ bg: 'black' }}
                                            isLoading={isSaving} 
                                            onClick={handleSaveClick}
                                            leftIcon={<CheckIcon />}
                                            px={6}
                                        >
                                            {editingKey ? t('save') : t('add')}
                                        </Button>
                                    </Flex>
                                </VStack>
                            </Box>
                        </HStack>
                    )}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default ApiKeyManagerModal;
