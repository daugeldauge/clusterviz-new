#pragma GCC diagnostic ignored "-Wwrite-strings"

#include <iostream>
#include <cstring>
#include <string>
#include <cstdio>
#include <exception>
#include <set>
#include <map>
#include <vector>
#include <fstream>

#include <graphviz/gvc.h>

using std::exception;
using std::string;
using std::set;
using std::cout;
using std::endl;
using std::map;
using std::vector;
using std::pair;
using std::make_pair;

struct ConfigValue
{
    bool isNeeded;
    string color;
    ConfigValue(bool _isNeeded = false, string _color = string("")): isNeeded(_isNeeded), color(_color) {}
};

class Model
{
public:
    Model(): g(0) {}
    ~Model();

    void load(const char *filename);
    void loadConfig(const char *filename);
    void createLevels();
    void handleEdges();
    void assignTypesToLabels();
    void delAllLabels();
    void delSingleNodes();
    void printLevels();
    void pickLevels(int from, int to);
    void pickLevelsFromRoot(char *name, int levelsnum);
    void deleteLevels(int levelsnum);
    void deleteLevelsFromRoot(char *name, int levelsnum);
    void colorizeEdges();
    void printNodeTypes();
    void printEdgeTypes();
    void getNodeTypes(set<string> &types);
    void aggregateLeaves();
    void aggregate();
    void applyOption(int argc, char *argv[], int argn);
    void render(char *layout, char *render);
private:
    Agraph_t *g;
    vector<set<Agnode_t *>> levels;

    map<string, ConfigValue> edgeConfig;
    // static char *edgeTypes[];
    // static bool isTypeNeeded[];
    // static char *colors[];

    void clearSingleLinksLabels();
    void deleteNode(Agnode_t *n, int minLevel);
    set<Agedge_t *> getAllOutEdges(Agnode_t *n);
    set<Agnode_t *> getParents(Agnode_t *n);
    void assignCount(Agnode_t *n, int count);
    bool isEqual(Agnode_t *n1, Agnode_t *n2);
    void getRoots(set<Agnode_t *> &roots);
    void getLeaves(set<Agnode_t *> &leaves);
    static char *toCstr(const string &s) { return const_cast<char *>(s.c_str()); }
    static string getType(const string &label);
    static bool isOfType(Agedge_t *e, char *type);
    static bool isOfType(Agnode_t *n, const string &type) { return string(agget(n, "label")) == type;}
    void pickLevelsRecursively(Agnode_t *n, int levelsnum);
    void deleteLevelsRecursively(Agnode_t *n, int levelsnum);
};

// char *Model::edgeTypes[] =   { "contain",  "chill",    "power",    "ib",       "eth",      "serv_eth", "panasas_eth" };
// bool Model::isTypeNeeded[] = {  1,          0,          0,          0,          0,          0,          0            };
// char *Model::colors[] =      { "gray16",   "cyan",     "red",      "blue",     "gold",     "gold3",    "gold4"       };

// const map<string, ConfigValue> Model::edgeConfig = {
//     make_pair("contain",     ConfigValue(0, "gray16")),
//     make_pair("chill",       ConfigValue(0, "cyan"  )),
//     make_pair("power",       ConfigValue(0, "red"   )),
//     make_pair("ib",          ConfigValue(1, "blue"  )),
//     make_pair("eth",         ConfigValue(0, "gold"  )),
//     make_pair("serv_eth",    ConfigValue(0, "gold3" )),
//     make_pair("panasas_eth", ConfigValue(0, "gold4" )) 
// };

Model::~Model()
{
    if (g) {
        agclose(g); 
    }
}

void Model::loadConfig(const char *filename)
{
    std::ifstream in;
    in.open(filename, std::ios::in);
    while (!in.eof()) {
        string edgeType;
        ConfigValue configValue;
        in >> edgeType >> configValue.isNeeded >> configValue.color;
        if (in.fail()) {
            throw string("Invalid configuration file");
        }
        edgeConfig.insert(make_pair(edgeType, configValue));
    }
}

void Model::load(const char *filename)
{
    FILE *chebdot = fopen(filename, "r");
    if (!chebdot) {
        throw string("Unable to open `") + string(filename) + string("` for reading.");
    }
    g = agread(chebdot, 0);
    agattr(g, AGNODE, "xlabel", "");
    //agattr(g, AGNODE, "overlap", "prism=1000");
    //agattr(g, AGEDGE, "arrowhead", "empty");
    fclose(chebdot);
}

void Model::createLevels()
{
    levels.clear();
    int nodesLeft = 1;
    for (int i = 0; nodesLeft != 0; ++i) {
        levels.push_back(set<Agnode_t *>());
        nodesLeft = 0;
        for (Agnode_t *n = agfstnode(g); n; n = agnxtnode(g, n)) {
            
            if (agget(n, "xlabel") == string("*")) {
                continue;
            }
            
            bool toInclude = true;
            for (Agedge_t *e = agfstin(g, n); e; e = agnxtin(g, e)) {
                if (agget(agtail(e), "xlabel") != string("*") || levels[i].find(agtail(e)) != levels[i].end()) {
                    toInclude = false;
                }
            }            

            if (toInclude) {
                agset(n, "xlabel", "*");
                // cout << i << '\t' << agnameof(n) << endl; 
                levels[i].insert(n);
            } else {
                ++nodesLeft;
            }
        }
    }    
}

string Model::getType(const string &s) 
{
    size_t from = s.find("'type' = '");
    if (from == string::npos) {
        return string("");
    }
    from += 10;
    size_t to = s.find_first_of('\'', from );
    if (to == string::npos) {
        return string("");
    }
    return s.substr(from, to - from);
}

void Model::assignTypesToLabels()
{
    for (Agnode_t *n = agfstnode(g); n; n = agnxtnode(g, n)) {
        agset(n, "label", toCstr(getType(agget(n, "label"))));
        for (Agedge_t *e = agfstout(g, n); e; e = agnxtout(g, e)) {
            agset(e, "label", toCstr(getType(agget(e, "label"))));            
        }
    }
}

void Model::handleEdges()
{
    Agnode_t *n, *m;
    for (n = agfstnode(g); n; n = m) {
        m = agnxtnode(g, n);

        Agedge_t *e, *f;
        for (e = agfstout(g, n); e; e = f) {
            f = agnxtout(g, e);

            auto it = edgeConfig.find(agget(e, "label"));
            if (it == edgeConfig.end()) {
                cout << agget(e, "label");
                throw string("Unexpected edge type");
            }
            if (!it->second.isNeeded) {
                agdeledge(g, e);
            }
        }
    }   
}

void Model::delAllLabels()
{
    Agnode_t *n, *m;
    for (n = agfstnode(g); n; n = m) {
        m = agnxtnode(g, n);

        Agedge_t *e, *f;
        for (e = agfstout(g, n); e; e = f) {
            f = agnxtout(g, e);
            agset(e, "label", "");
        }

        //agset(n, "label", "");
        agset(n, "xlabel", "");
    }
}

void Model::delSingleNodes()
{
    Agnode_t *n, *m;
    for (n = agfstnode(g); n; n = m) {
        m = agnxtnode(g, n);
        if (!agfstout(g, n) && !agfstin(g, n)) {
            agdelnode(g, n);
        }
    }
}

void Model::pickLevelsRecursively(Agnode_t *root, int levelsnum)
{
    set<Agnode_t *> nextLevelNodes;

    for (Agedge_t *e = agfstout(g, root); e; e = agnxtout(g, e)) {
        if (isOfType(e, "contain")) {
            nextLevelNodes.insert(aghead(e));
        }
    }

    for (auto n = nextLevelNodes.begin(); n != nextLevelNodes.end(); ++n) {
        pickLevelsRecursively(*n, levelsnum - 1);
    }

    agset(root, "xlabel", "ok");
    if (levelsnum < 0) {
        agdelnode(g, root);
    }
}

void Model::getRoots(set<Agnode_t *> &roots)
{
    roots.clear();

    for (Agnode_t *n = agfstnode(g); n; n = agnxtnode(g, n)) {
        Agedge_t *e;
        for (e = agfstin(g, n); e; e = agnxtin(g, e)) {
            if (isOfType(e, "contain")) {
                break;
            }
        }
        if(!e) {
            roots.insert(n);
        }
    }

}

void Model::pickLevels(int from, int to)
{
    for (int i = static_cast<int>(levels.size()) - 1; i >= 0; --i) {
        if (i < from || i > to) {
            for (auto node = levels[i].begin(); node != levels[i].end(); ++node) {
                agdelnode(g, *node);
            }
            levels.erase(levels.begin() + i);
        }
    }
}


void Model::colorizeEdges()
{
    agattr(g, AGEDGE, "color", "black");
    for (Agnode_t *n = agfstnode(g); n; n = agnxtnode(g, n)) {
        for (Agedge_t *e = agfstout(g, n); e; e = agnxtout(g, e)) {
            auto it = edgeConfig.find(agget(e, "label"));
            if (it == edgeConfig.end()) {
                throw string("Unexpected edge type");
            }
            agset(e, "color", toCstr(it->second.color));
        }
    }
} 

void Model::render(char *layout, char *filename)
{
    GVC_t *gvc = gvContext();
    gvLayout(gvc, g, layout);
    gvRenderFilename(gvc, g, "svg", filename);
    gvFreeLayout(gvc, g);
    gvFreeContext(gvc);
    //not necessary
    // FILE *out = fopen("res.dot", "w"); 
    // agwrite(g, out);
    // fclose(out);
}

inline bool Model::isOfType(Agedge_t *e, char *type)
{ 
    char *label = agget(e, "label");
    if (!label) {
        return false;
    }
    return (strcmp(label, type) == 0);
}

void Model::printEdgeTypes()
{
    set<string> types;
    for (Agnode_t *n = agfstnode(g); n; n = agnxtnode(g, n)) {
        for (Agedge_t *e = agfstout(g, n); e; e = agnxtout(g, e)) {
            types.insert(getType(agget(e, "label")));
        }
    }

    for (auto it = types.begin(); it != types.end(); ++it) {
        cout << *it << " ";
    }
    cout << endl;
}

void Model::getNodeTypes(set<string> &types)
{
    for (Agnode_t *n = agfstnode(g); n; n = agnxtnode(g, n)) {
        types.insert(getType(agget(n, "label")));
    }
}

void Model::printNodeTypes()
{
    set<string> types;
    getNodeTypes(types);

    for (auto it = types.begin(); it != types.end(); ++it) {
        cout << *it << endl;
    }
}

void Model::aggregateLeaves()
{
    set<string> types;

    for (Agnode_t *n = agfstnode(g); n; n = agnxtnode(g, n)) {
        types.insert(agget(n, "label"));
    }

    set<Agnode_t *> roots;
    getRoots(roots);

    for (auto root = roots.begin(); root != roots.end(); ++root) {
        for (auto type = types.begin(); type != types.end(); ++type) {
            int n = 0;
            for (Agedge_t *e = agfstout(g, *root); e; e = agnxtout(g, e)) {
                if (isOfType(aghead(e), *type)) {
                    ++n;
                }
            }
            Agedge_t *e = agfstout(g, *root), *f;
            for (int i = 1; i < n; e = f) {
                f = agnxtout(g, e);
                if (isOfType(aghead(e), *type)) {
                    ++i;
                    agdelnode(g, aghead(e));
                }
            }
            for (Agedge_t *e = agfstout(g, *root); e; e = agnxtout(g, e)) {
                if (isOfType(aghead(e), *type)) {
                    agset(e, "label", toCstr(std::to_string((long long)n)));
                }
            }
        }
    }
}

void Model::getLeaves(set<Agnode_t *> &leaves)
{
    leaves.clear();
    for (Agnode_t *n = agfstnode(g); n; n = agnxtnode(g, n)) {
        if (agfstout(g, n) == 0) {
            leaves.insert(n);
        }
    }
}

set<Agedge_t *> Model::getAllOutEdges(Agnode_t *n)
{
    set<Agedge_t *> edges;
    for (Agedge_t *e = agfstout(g, n); e; e = agnxtout(g, e)) {
        edges.insert(e);
    }
    return edges;
}

set<Agnode_t *> Model::getParents(Agnode_t *n) 
{
    set<Agnode_t *> parents;
    for (Agedge_t *e = agfstin(g, n); e; e = agnxtin(g, e)) {
        parents.insert(agtail(e));
    }
    return parents;
}

//equal but not identical
bool Model::isEqual(Agnode_t *n1, Agnode_t *n2)
{
    if (n1 == n2) {
        return false;
    }
    if (strcmp(agget(n1, "label"), agget(n2, "label"))) {
        return false;
    }

    set<Agnode_t *> n1Parents, n2Parents;
    n1Parents = getParents(n1);
    n2Parents = getParents(n2);
    
    if (n1Parents.size() != n2Parents.size()) {
        return false;
    }

    for (auto u = n1Parents.begin(); u != n1Parents.end(); ++u) {
        bool isFinded = false;
        for (auto v = n2Parents.begin(); v != n2Parents.end(); ++v) {
            if (strcmp(agget(*u, "label"), agget(*v, "label")) == 0) {
                isFinded = true;
                n2Parents.erase(*v);
                break;
            }
        }
        if (!isFinded) {
            return false;
        }
    }


    set<Agedge_t *> n1Edges, n2Edges;
    n1Edges = getAllOutEdges(n1);
    n2Edges = getAllOutEdges(n2);

    if (n1Edges.size() != n2Edges.size()) {
        return false;
    }

    for (auto u = n1Edges.begin(); u != n1Edges.end(); ++u) {
        bool isFinded = false;
        for (auto v = n2Edges.begin(); v != n2Edges.end(); ++v) {
            if (strcmp(agget(*u, "label"), agget(*v, "label"))) {
                continue;
            }
            if (isEqual(aghead(*u), aghead(*v))) {
                isFinded = true;
                break;
            }
        }
        if (!isFinded) {
            return false;
        }
    }
    return true;
}

void Model::deleteNode(Agnode_t *n, int minLevel)
{
    Agedge_t *e, *f;
    for (e = agfstout(g, n); e; e = f) {
        f = agnxtout(g, e);
        deleteNode(aghead(e), minLevel + 1);
    }

    int i = minLevel;
    set<Agnode_t *>::iterator it;
    do {
        if (i >= int(levels.size())) {
            throw string("Needed node hasn't been found in levels");
        }
        it = levels[i].find(n);
    } while (it == levels[i++].end());
    
    levels[i - 1].erase(n);
    agdelnode(g, n);
}

void Model::assignCount(Agnode_t *n, int count)
{
    for (Agedge_t *e = agfstin(g, n); e; e = agnxtin(g, e)) {
        agset(e, "label", toCstr(std::to_string((long long)count)));
    }
}
void Model::clearSingleLinksLabels()
{
    for (Agnode_t *n = agfstnode(g); n; n = agnxtnode(g, n)) {
        for (Agedge_t *e = agfstout(g, n); e; e = agnxtout(g, e)) {
            if (agget(e, "label") == string("1")) {
                agset(e, "label", ""); 
            }            
        }
    }
}
void Model::aggregate()
{
    for (int i = levels.size() - 2; i >= 0; --i) {
        for (auto node = levels[i].begin(); node != levels[i].end(); ++node) {
            for (Agedge_t *e = agfstout(g, *node); e; e = agnxtout(g, e)) {
                int linkCount;
                if (sscanf(agget(e, "label"), "%d", &linkCount) > 0) {
                    continue;
                }
                linkCount = 1;

                Agedge_t *u, *v;
                for (u = agfstout(g, *node); u; u = v) {
                    v = agnxtout(g, u);
                    Agnode_t *head = aghead(u);

                    if (isEqual(head, aghead(e))) {
                        ++linkCount;
                        deleteNode(head, i);
                    }
                }

                assignCount(aghead(e), linkCount);
                //agset(e, "label", toCstr(std::to_string((long long)linkCount)));

                e = agfstout(g, *node);
            }
        }
    }
    clearSingleLinksLabels();
}


void Model::printLevels()
{
    for (unsigned int i = 0; i < levels.size(); ++i) {
        cout << "level " << i << ":" << endl;
        for (auto node = levels[i].begin(); node != levels[i].end(); ++node) {
            cout  << "\t" << agnameof(*node) << "\t" << agget(*node, "label") << endl; 
        }
        cout << endl;
    }
}

void Model::applyOption(int argc, char *argv[], int argn)
{
    if (argn < argc) {
        if (argv[argn] == string("--aggregate")) {
            aggregate();
        } else if (argv[argn] == string("--remove-single-nodes")) {
            delSingleNodes();
        } else if (strncmp(argv[argn], "--edge-type=", sizeof("--edge-type=") - 1) == 0) {
            edgeConfig[argv[argn] + sizeof("--edge-type=") - 1].isNeeded = true;
        }

    }
}

int main(int argc, char *argv[])
{
    try {
        Model m;
        m.load(argv[1]);
        if (argv[2] == string("--print-edge-types")) {
            m.printEdgeTypes();
            return 0;
        }
        
        m.loadConfig("config.txt");
        m.applyOption(argc, argv, 6);

        m.assignTypesToLabels();
        m.handleEdges();
        m.createLevels();
        m.colorizeEdges();
        m.delAllLabels();

        int from = atoi(argv[2]);
        int to = atoi(argv[3]);
        if (from != -1 && to != -1) {
            m.pickLevels(from, to);
        }
        //cout << "ok" << endl;
        
        m.applyOption(argc, argv, 7);
        //cout << "ok" << endl;
        m.applyOption(argc, argv, 8);
        //cout << "ok" << endl;
        m.render(argv[4], argv[5]);
    } catch (const string &s) {
        std::cout << "Error: " << s << std::endl; 
        return 1;
    }
    return 0;
}