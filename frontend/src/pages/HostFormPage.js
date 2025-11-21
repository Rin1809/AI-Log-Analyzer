import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import {
  Box, Button, FormControl, FormLabel, Input, VStack, Heading, useToast,
  HStack, IconButton, Select, Card, CardBody, CardHeader, Text, Divider,
  Switch, NumberInput, NumberInputField, NumberInputStepper, NumberIncrementStepper, NumberDecrementStepper,
  useColorModeValue, Flex, Checkbox, Tooltip, SimpleGrid,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  Wrap, WrapItem, Tag, TagLabel, TagCloseButton, Alert, AlertIcon, InputGroup, InputLeftElement,
  Spinner, Center, Badge
} from '@chakra-ui/react';
import { 
    ArrowBackIcon, AddIcon, ArrowUpIcon, ArrowDownIcon, 
    AttachmentIcon, SearchIcon, EmailIcon, SettingsIcon, MinusIcon
} from '@chakra-ui/icons';

import PromptManager from '../components/hosts/PromptManager';
import ApiKeySelector from '../components/hosts/ApiKeySelector'; 
import MapReduceEditor from '../components/hosts/MapReduceEditor'; 
import { useLanguage } from '../context/LanguageContext';

const StatusBadge = ({ isEnabled }) => {
    const onlineColor = useColorModeValue('green.500', 'green.400');
    const offlineColor = useColorModeValue('red.500', 'red.400');
    const onlineBg = useColorModeValue('green.100', 'green.800');
    const offlineBg = useColorModeValue('red.100', 'red.800');
    const { t } = useLanguage();
  
    return (
      <Flex
        alignItems="center"
        bg={isEnabled ? onlineBg : offlineBg}
        color={isEnabled ? onlineColor : offlineColor}
        borderRadius="full"
        px={3}
        py={1}
        w="fit-content"
      >
        <Box w="8px" h="8px" borderRadius="full" bg={isEnabled ? onlineColor : offlineColor} mr={2} />
        <Text fontSize="sm" fontWeight="medium" lineHeight="1">
          {isEnabled ? t('online') : t('disabled')}
        </Text>
      </Flex>
    );
};

const HostFormPage = () => {
    const { isTestMode } = useOutletContext();
    const { hostId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const { t } = useLanguage();
    
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const contextInputRef = useRef(null);
    const diagramInputRef = useRef(null);

    const [basicInfo, setBasicInfo] = useState({
        syshostname: '', logfile: '/var/log/filter.log', timezone: 'Asia/Ho_Chi_Minh',
        run_interval_seconds: 3600, hourstoanalyze: 24, geminiapikey: '',
        networkdiagram: '', smtp_profile: '', context_files: [],
        chunk_size: 8000, enabled: 'True'
    });

    const [pipeline, setPipeline] = useState([]);
    const [geminiModels, setGeminiModels] = useState({});
    const [smtpProfiles, setSmtpProfiles] = useState([]);
    const [availableContextFiles, setAvailableContextFiles] = useState([]);
    
    const [contextSearch, setContextSearch] = useState('');
    const [filesToDelete, setFilesToDelete] = useState([]);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [currentStageIndex, setCurrentStageIndex] = useState(null);
    const [emailInput, setEmailInput] = useState('');

    const bg = useColorModeValue("white", "gray.800");
    const hoverBg = useColorModeValue('gray.50', 'gray.700');
    const btnAddBg = useColorModeValue('gray.100', 'gray.700');
    
    const saveButtonBg = useColorModeValue('gray.800', 'white');
    const saveButtonColor = useColorModeValue('white', 'gray.800');
    const saveButtonHoverBg = useColorModeValue('black', 'gray.200');

    const trashIconBg = useColorModeValue('gray.200', 'gray.600');
    const stageTrashBg = useColorModeValue('gray.100', 'gray.700');

    const addStage = () => {
        const defaultModel = Object.values(geminiModels)[0] || 'gemini-2.5-flash-lite';
        const newStage = {
            name: `Stage ${pipeline.length}`,
            enabled: true,
            model: defaultModel,
            prompt_file: pipeline.length === 0 ? 'prompt_template.md' : 'summary_prompt_template.md',
            trigger_threshold: pipeline.length === 0 ? 1 : 12,
            recipient_emails: '',
            substages: [], 
            summary_conf: {} 
        };
        setPipeline([...pipeline, newStage]);
    };

    const removeStage = (idx) => {
        if (pipeline.length <= 1 && idx === 0) return toast({title: "Cannot remove Source Stage", status: "error"});
        const newP = [...pipeline];
        newP.splice(idx, 1);
        setPipeline(newP);
    };

    const moveStage = (idx, direction) => {
        if ((direction === -1 && idx === 0) || (direction === 1 && idx === pipeline.length - 1)) return;
        const newP = [...pipeline];
        const temp = newP[idx];
        newP[idx] = newP[idx + direction];
        newP[idx + direction] = temp;
        setPipeline(newP);
    };

    const updateStage = (idx, field, value) => {
        const newP = [...pipeline];
        newP[idx] = { ...newP[idx], [field]: value };
        setPipeline(newP);
    };
    
    const handleAddSubstage = (stageIdx) => {
        const defaultModel = Object.values(geminiModels)[0] || 'gemini-2.5-flash-lite';
        const newP = [...pipeline];
        if (!newP[stageIdx].substages) newP[stageIdx].substages = [];
        
        newP[stageIdx].substages.push({
            name: `Worker ${newP[stageIdx].substages.length + 1}`,
            enabled: true,
            model: defaultModel,
            prompt_file: 'prompt_template.md',
            gemini_api_key: '' 
        });
        setPipeline(newP);
    };

    const handleRemoveSubstage = (stageIdx, subIdx) => {
         const newP = [...pipeline];
         newP[stageIdx].substages.splice(subIdx, 1);
         setPipeline(newP);
    };

    const handleUpdateSubstage = (stageIdx, subIdx, field, value) => {
         const newP = [...pipeline];
         newP[stageIdx].substages[subIdx] = { ...newP[stageIdx].substages[subIdx], [field]: value };
         setPipeline(newP);
    };
    
    const handleUpdateSummaryConf = (stageIdx, field, value) => {
        const newP = [...pipeline];
        if (!newP[stageIdx].summary_conf) newP[stageIdx].summary_conf = {};
        newP[stageIdx].summary_conf = { ...newP[stageIdx].summary_conf, [field]: value };
        setPipeline(newP);
    };

    useEffect(() => {
        const init = async () => {
            try {
                const [models, settings, files] = await Promise.all([
                    axios.get('/api/gemini-models'),
                    axios.get('/api/system-settings', { params: { test_mode: isTestMode }}),
                    axios.get('/api/context-files', { params: { test_mode: isTestMode }})
                ]);
                setGeminiModels(models.data);
                setSmtpProfiles(Object.keys(settings.data.smtp_profiles || {}));
                setAvailableContextFiles(files.data.map(f => `Bonus_context/${f}`));

                if (hostId) {
                    const res = await axios.get(`/api/hosts/${hostId}`, { params: { test_mode: isTestMode }});
                    const { pipeline: pl, ...rest } = res.data;
                    setBasicInfo(prev => ({ ...prev, ...rest }));
                    setPipeline(pl && pl.length > 0 ? pl : createDefaultPipeline(models.data));
                } else {
                    setPipeline(createDefaultPipeline(models.data));
                }
            } catch (e) {
                console.error(e);
                toast({ title: t('loadFailed'), description: e.message, status: "error" });
            } finally { setLoading(false); }
        };
        init();
    }, [hostId, isTestMode, toast, t]);

    const createDefaultPipeline = (models) => {
        const defaultModel = Object.values(models)[0] || 'gemini-2.5-flash-lite';
        return [
            { name: 'Periodic Scan', enabled: true, model: defaultModel, prompt_file: 'prompt_template.md', trigger_threshold: 1, substages: [], summary_conf: {} },
            { name: 'Daily Summary', enabled: true, model: defaultModel, prompt_file: 'summary_prompt_template.md', trigger_threshold: 24 },
        ];
    }

    const handleFileUpload = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await axios.post('/api/upload/context', formData, { params: { test_mode: isTestMode } });
            
            if (type === 'diagram') {
                setBasicInfo(prev => ({ ...prev, networkdiagram: res.data.path }));
                toast({ title: t('success'), status: "success" });
            } else {
                const newPath = `Bonus_context/${res.data.filename}`;
                setAvailableContextFiles(prev => prev.includes(newPath) ? prev : [...prev, newPath]);
                setBasicInfo(prev => ({ ...prev, context_files: [...prev.context_files, newPath] }));
                toast({ title: t('success'), status: "success" });
            }
        } catch (err) {
            toast({ title: t('error'), description: err.response?.data?.detail || err.message, status: 'error' });
        }
    };

    const toggleContextFile = (file) => {
        setBasicInfo(prev => {
            const exists = prev.context_files.includes(file);
            return {
                ...prev,
                context_files: exists ? prev.context_files.filter(f => f !== file) : [...prev.context_files, file]
            };
        });
    };

    const handleBulkDeleteClick = () => {
        const files = basicInfo.context_files.filter(f => availableContextFiles.includes(f));
        if (files.length === 0) return;
        setFilesToDelete(files);
        setIsDeleteModalOpen(true);
    }

    const confirmDeleteFiles = async () => {
        if (filesToDelete.length === 0) return;
        let successCount = 0;
        for (const file of filesToDelete) {
            try {
                const filename = file.split('/').pop();
                await axios.delete(`/api/context-files/${filename}`, { params: { test_mode: isTestMode } });
                successCount++;
            } catch (err) { console.error(err); }
        }
        
        const deletedSet = new Set(filesToDelete);
        setAvailableContextFiles(prev => prev.filter(f => !deletedSet.has(f)));
        setBasicInfo(prev => ({ ...prev, context_files: prev.context_files.filter(f => !deletedSet.has(f)) }));
        
        toast({ title: t('success'), description: `Deleted ${successCount} files.`, status: "success" });
        setIsDeleteModalOpen(false);
        setFilesToDelete([]);
    };

    const openEmailModal = (idx) => {
        setCurrentStageIndex(idx);
        setIsEmailModalOpen(true);
        setEmailInput('');
    };

    const addEmail = () => {
        if (!emailInput || currentStageIndex === null) return;
        const rawEmails = pipeline[currentStageIndex].recipient_emails || '';
        const currentEmails = rawEmails.split(',').map(e=>e.trim()).filter(Boolean);
        
        if (!currentEmails.includes(emailInput.trim())) {
            const newEmails = [...currentEmails, emailInput.trim()].join(',');
            updateStage(currentStageIndex, 'recipient_emails', newEmails);
        }
        setEmailInput('');
    };

    const removeEmail = (emailToRemove) => {
        if (currentStageIndex === null) return;
        const rawEmails = pipeline[currentStageIndex].recipient_emails || '';
        const currentEmails = rawEmails.split(',').map(e=>e.trim()).filter(Boolean);
        
        const newEmails = currentEmails.filter(e => e !== emailToRemove).join(',');
        updateStage(currentStageIndex, 'recipient_emails', newEmails);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = { 
                ...basicInfo, 
                pipeline,
                enabled: basicInfo.enabled === 'True' 
            };
            
            if (hostId) await axios.put(`/api/hosts/${hostId}`, payload, { params: { test_mode: isTestMode }});
            else await axios.post('/api/hosts', payload, { params: { test_mode: isTestMode }});
            
            toast({ title: t('saveSuccess'), status: "success" });
            navigate('/status');
        } catch (e) {
            toast({ title: t('saveError'), description: e.response?.data?.detail || e.message, status: "error" });
        } finally { setIsSaving(false); }
    };
    
    const filteredContextFiles = availableContextFiles.filter(f => f.toLowerCase().includes(contextSearch.toLowerCase()));
    const hasSelectedFiles = basicInfo.context_files.length > 0;

    if(loading) {
        return <Center h="80vh"><Spinner size="xl" /></Center>;
    }

    return (
        <VStack spacing={6} align="stretch" pb={20}>
            <Flex align="center" justify="space-between">
                <HStack>
                    <IconButton icon={<ArrowBackIcon />} onClick={() => navigate('/status')} variant="ghost" aria-label="Back" />
                    <Heading size="lg" fontWeight="normal">{hostId ? t('editHost') : t('newHost')}</Heading>
                    
                    {hostId && (
                        <StatusBadge isEnabled={String(basicInfo.enabled) === 'True'} />
                    )}
                </HStack>
                <Button 
                    isLoading={isSaving} 
                    onClick={handleSave} 
                    leftIcon={<SettingsIcon />}
                    bg={saveButtonBg} 
                    color={saveButtonColor} 
                    _hover={{ bg: saveButtonHoverBg }}
                    size="md"
                    fontWeight="normal"
                >
                    {t('save')}
                </Button>
            </Flex>

            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
                <VStack spacing={6} align="stretch">
                    <Card bg={bg}>
                        <CardHeader><Heading size="md" fontWeight="normal">{t('basicInfo')}</Heading></CardHeader>
                        <CardBody>
                            <VStack spacing={4}>
                                <FormControl isRequired><FormLabel>{t('hostname')}</FormLabel>
                                    <Input value={basicInfo.syshostname} onChange={e=>setBasicInfo({...basicInfo, syshostname: e.target.value})} />
                                </FormControl>
                                <FormControl><FormLabel>{t('logFilePath')}</FormLabel>
                                    <Input value={basicInfo.logfile} onChange={e=>setBasicInfo({...basicInfo, logfile: e.target.value})}/>
                                </FormControl>
                                
                            
                                <SimpleGrid columns={2} spacing={4} w="full">
                                    <FormControl><FormLabel>{t('timezone')}</FormLabel>
                                        <Input value={basicInfo.timezone} onChange={e=>setBasicInfo({...basicInfo, timezone: e.target.value})}/>
                                    </FormControl>
                                    <FormControl><FormLabel>{t('intervalSec')}</FormLabel>
                                        {/* FIX: Use valString (first arg) to allow empty input without NaN */}
                                        <NumberInput value={basicInfo.run_interval_seconds} onChange={(valStr) => setBasicInfo({...basicInfo, run_interval_seconds: valStr})}>
                                            <NumberInputField /><NumberInputStepper><NumberIncrementStepper /><NumberDecrementStepper /></NumberInputStepper>
                                        </NumberInput>
                                    </FormControl>
                                </SimpleGrid>
                                
                                <FormControl isRequired>
                                    <FormLabel>{t('geminiApiKey')}</FormLabel>
                                    <ApiKeySelector 
                                        value={basicInfo.geminiapikey} 
                                        onChange={(val) => setBasicInfo({...basicInfo, geminiapikey: val})}
                                        isTestMode={isTestMode}
                                    />
                                </FormControl>
                            </VStack>
                        </CardBody>
                    </Card>

                    <Card bg={bg}>
                        <CardHeader><Heading size="md" fontWeight="normal">{t('resourcesContext')}</Heading></CardHeader>
                        <CardBody>
                            <VStack spacing={4} align="stretch">
                                <FormControl>
                                    <FormLabel>{t('smtpProfile')}</FormLabel>
                                    <Select placeholder={t('useSystemDefault')} value={basicInfo.smtp_profile} onChange={e => setBasicInfo({...basicInfo, smtp_profile: e.target.value})}>
                                        {smtpProfiles.map(p => <option key={p} value={p}>{p}</option>)}
                                    </Select>
                                </FormControl>
                                
                                <Divider />
                                
                                <FormControl>
                                    <FormLabel>{t('networkDiagram')}</FormLabel>
                                    <Box 
                                        position="relative" borderWidth="2px" borderStyle="dashed" borderColor="gray.300" 
                                        borderRadius="md" p={4} textAlign="center" cursor="pointer" _hover={{ borderColor: "blue.400", bg: hoverBg }}
                                        onClick={() => !basicInfo.networkdiagram && diagramInputRef.current.click()}
                                    >
                                         <input type="file" ref={diagramInputRef} style={{ display: 'none' }} accept="image/*" onChange={e => handleFileUpload(e, 'diagram')} />
                                         {basicInfo.networkdiagram ? (
                                            <Box position="relative">
                                                <HStack justify="center" spacing={2}>
                                                    <AttachmentIcon color="green.500" />
                                                    <Text fontSize="sm" fontWeight="normal" isTruncated>{basicInfo.networkdiagram.split('/').pop()}</Text>
                                                </HStack>
                                                <IconButton 
                                                    size="xs" icon={<MinusIcon />} position="absolute" top="-10px" right="-10px" 
                                                    variant="ghost" color="gray.500" rounded="full" bg={trashIconBg}
                                                    _hover={{ bg: 'red.100', color: 'red.500' }}
                                                    onClick={(e) => { e.stopPropagation(); setBasicInfo(p => ({...p, networkdiagram: ''})); }}
                                                />
                                            </Box>
                                         ) : (
                                            <VStack spacing={1}><AttachmentIcon boxSize={5} color="gray.400" /><Text fontSize="sm" color="gray.500">{t('clickToUpload')}</Text></VStack>
                                         )}
                                    </Box>
                                </FormControl>

                                <Divider />

                                <FormControl>
                                    <Flex justify="space-between" align="center" mb={2}>
                                        <FormLabel mb={0}>{t('contextFiles')}</FormLabel>
                                        <HStack>
                                            <InputGroup size="sm" w="120px">
                                                <InputLeftElement pointerEvents="none"><SearchIcon color="gray.300" /></InputLeftElement>
                                                <Input placeholder={t('search')} value={contextSearch} onChange={e => setContextSearch(e.target.value)} />
                                            </InputGroup>
                                            <input type="file" ref={contextInputRef} style={{display: 'none'}} onChange={e => handleFileUpload(e, 'context')} />
                                            <Tooltip label={t('uploadNew')}><IconButton size="sm" icon={<AddIcon />} onClick={() => contextInputRef.current.click()} /></Tooltip>
                                            
                                            <Tooltip label={t('deleteSelected')}>
                                                <IconButton 
                                                    size="sm" icon={<MinusIcon />} 
                                                    variant="ghost" bg={hasSelectedFiles ? trashIconBg : 'transparent'}
                                                    color={hasSelectedFiles ? "gray.600" : "gray.300"}
                                                    _hover={hasSelectedFiles ? { bg: 'red.100', color: 'red.500' } : {}}
                                                    isDisabled={!hasSelectedFiles} onClick={handleBulkDeleteClick} 
                                                />
                                            </Tooltip>
                                        </HStack>
                                    </Flex>
                                    <Box maxH="150px" overflowY="auto" borderWidth="1px" borderRadius="md" p={2}>
                                        {filteredContextFiles.length > 0 ? filteredContextFiles.map(f => (
                                            <Checkbox key={f} isChecked={basicInfo.context_files.includes(f)} onChange={() => toggleContextFile(f)} w="full" size="sm" py={1} _hover={{ bg: hoverBg }}>
                                                <Text fontSize="xs" isTruncated>{f.split('/').pop()}</Text>
                                            </Checkbox>
                                        )) : <Text fontSize="xs" color="gray.500">{t('noFilesFound')}</Text>}
                                    </Box>
                                </FormControl>
                            </VStack>
                        </CardBody>
                    </Card>
                </VStack>

                <VStack spacing={6} align="stretch">
                    <Card bg={bg} h="full">
                        <CardHeader>
                            <Flex justify="space-between" align="center">
                                <Heading size="md" fontWeight="normal">{t('analysisPipeline')}</Heading>
                                <Button leftIcon={<AddIcon />} size="sm" onClick={addStage} bg={btnAddBg} fontWeight="normal">{t('addStage')}</Button>
                            </Flex>
                        </CardHeader>
                        <CardBody>
                            <VStack spacing={4} align="stretch">
                                {pipeline.map((stage, idx) => (
                                    <Box key={idx} borderWidth="1px" borderRadius="md" p={3} position="relative" _hover={{ borderColor: "blue.300", boxShadow: "sm" }}>
                                        <Flex justify="space-between" mb={2} align="center" wrap="wrap" gap={2}>
                                            <HStack flex="1" minW="0">
                                                <Badge 
                                                    colorScheme={idx === 0 ? "blue" : "purple"} 
                                                    variant="subtle" 
                                                    fontSize="0.8em"
                                                    fontWeight="normal"
                                                    px={2} 
                                                    py={1}
                                                    borderRadius="full"
                                                    flexShrink={0}
                                                >
                                                    {idx === 0 ? `#0 ${t('sourceStage')}` : `#${idx} ${t('aggregationStage')}`}
                                                </Badge>
                                                
                                                <Input 
                                                    size="sm" 
                                                    value={stage.name} 
                                                    onChange={e=>updateStage(idx, 'name', e.target.value)} 
                                                    w="auto"
                                                    flex="1"
                                                    minW="100px"
                                                    fontWeight="normal" 
                                                    variant="unstyled" 
                                                />
                                            </HStack>
                                            <HStack spacing={1} flexShrink={0}>
                                                <IconButton size="xs" icon={<ArrowUpIcon />} isDisabled={idx===0} onClick={()=>moveStage(idx, -1)} variant="ghost"/>
                                                <IconButton size="xs" icon={<ArrowDownIcon />} isDisabled={idx===pipeline.length-1} onClick={()=>moveStage(idx, 1)} variant="ghost"/>
                                                
                                                <IconButton 
                                                    size="xs" icon={<MinusIcon />} 
                                                    variant="ghost" color="gray.500" bg={stageTrashBg}
                                                    _hover={{ bg: 'red.100', color: 'red.500' }}
                                                    onClick={()=>removeStage(idx)} 
                                                />
                                            </HStack>
                                        </Flex>
                                        
                                        <Divider mb={3} />
                                        
                                        <SimpleGrid columns={2} spacing={3}>
                                            <FormControl>
                                                <FormLabel fontSize="xs" mb={0} color="gray.500">{t('model')}</FormLabel>
                                                <Select size="xs" value={stage.model} onChange={e=>updateStage(idx, 'model', e.target.value)}>
                                                    {Object.entries(geminiModels).map(([k,v])=> <option key={v} value={v}>{k}</option>)}
                                                </Select>
                                            </FormControl>
                                            
                                            <FormControl>
                                                <FormLabel fontSize="xs" mb={0} color="gray.500">{t('promptFile')}</FormLabel>
                                                <PromptManager 
                                                    value={stage.prompt_file} 
                                                    onChange={(newVal) => updateStage(idx, 'prompt_file', newVal)}
                                                    isTestMode={isTestMode}
                                                />
                                            </FormControl>

                                            {idx === 0 ? (
                                                <FormControl>
                                                    <FormLabel fontSize="xs" mb={0} color="gray.500">{t('chunkSize')}</FormLabel>
                                                    {/* FIX: Use valString (first arg) to allow empty input without NaN */}
                                                    <NumberInput size="xs" min={100} max={50000} value={basicInfo.chunk_size} onChange={(valStr) => setBasicInfo({...basicInfo, chunk_size: valStr})}>
                                                        <NumberInputField />
                                                        <NumberInputStepper><NumberIncrementStepper /><NumberDecrementStepper /></NumberInputStepper>
                                                    </NumberInput>
                                                </FormControl>
                                            ) : (
                                                <FormControl>
                                                    <FormLabel fontSize="xs" mb={0} color="gray.500">{t('triggerThreshold')}</FormLabel>
                                                    <NumberInput size="xs" min={1} value={stage.trigger_threshold} onChange={(_,v)=>updateStage(idx, 'trigger_threshold', v)}>
                                                        <NumberInputField />
                                                    </NumberInput>
                                                </FormControl>
                                            )}
                                            
                                            <FormControl>
                                                <FormLabel fontSize="xs" mb={0} color="gray.500">{t('notifications')}</FormLabel>
                                                <Button size="xs" fontWeight="normal" leftIcon={<EmailIcon />} width="full" onClick={() => openEmailModal(idx)} variant="outline">
                                                    {t('manageEmails')} ({stage.recipient_emails ? stage.recipient_emails.split(',').filter(Boolean).length : 0})
                                                </Button>
                                            </FormControl>
                                        </SimpleGrid>
                                        

                                        {idx === 0 && (
                                            <Box mt={4} borderTopWidth="1px" borderColor="gray.100" pt={2}>
                                                <Text fontSize="xs" fontWeight="normal" color="gray" mb={2}>
                                                    {t('mapReduceArch')}
                                                </Text>
                                                <MapReduceEditor 
                                                    substages={stage.substages}
                                                    summaryConf={stage.summary_conf}
                                                    onAdd={() => handleAddSubstage(idx)}
                                                    onRemove={(subIdx) => handleRemoveSubstage(idx, subIdx)}
                                                    onUpdate={(subIdx, f, v) => handleUpdateSubstage(idx, subIdx, f, v)}
                                                    onUpdateSummary={(f, v) => handleUpdateSummaryConf(idx, f, v)}
                                                    geminiModels={geminiModels}
                                                    isTestMode={isTestMode}
                                                />
                                            </Box>
                                        )}
                                        
                                        {idx !== 0 && (
                                            <Flex justify="flex-end" mt={3}>
                                                <HStack>
                                                    <Text fontSize="xs" color="gray.500">{t('isEnabled')}</Text>
                                                    <Switch size="sm" isChecked={stage.enabled} onChange={e=>updateStage(idx, 'enabled', e.target.checked)} />
                                                </HStack>
                                            </Flex>
                                        )}
                                    </Box>
                                ))}
                            </VStack>
                        </CardBody>
                    </Card>
                </VStack>
            </SimpleGrid>

            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} isCentered>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader color="red.500">{t('deleteSelected')}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <Alert status="warning" mb={3}><AlertIcon />{t('cannotUndo')}</Alert>
                        <Text>{t('deleteFilesConfirm')}</Text>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="ghost" mr={3} onClick={() => setIsDeleteModalOpen(false)}>{t('cancel')}</Button>
                        <Button colorScheme="red" onClick={confirmDeleteFiles}>{t('delete')}</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Email Management Modal */}
            <Modal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} isCentered>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader fontWeight="normal" >{t('manageEmails')} - {currentStageIndex !== null && pipeline[currentStageIndex]?.name}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <HStack mb={4}>
                            <Input placeholder={t('enterEmail')} value={emailInput} onChange={(e) => setEmailInput(e.target.value)} />
                            <IconButton icon={<AddIcon />} onClick={addEmail} />
                        </HStack>
                        <Wrap>
                            {currentStageIndex !== null && (pipeline[currentStageIndex]?.recipient_emails || '').split(',').filter(Boolean).map(email => (
                                <WrapItem key={email}>
                                    <Tag size="md" borderRadius="full" variant="solid" colorScheme="blue">
                                        <TagLabel>{email}</TagLabel>
                                        <TagCloseButton onClick={() => removeEmail(email)} />
                                    </Tag>
                                </WrapItem>
                            ))}
                        </Wrap>
                    </ModalBody>
                    <ModalFooter>
                        <Button fontWeight={'normal'} onClick={() => setIsEmailModalOpen(false)}>{t('done')}</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </VStack>
    );
};

export default HostFormPage;